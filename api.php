<?php
// api.php
// Configuración de cabeceras para devolver JSON (misma-origen: no se necesita CORS)
header("Content-Type: application/json; charset=UTF-8");

// Cookie de sesión endurecida: no accesible por JS, solo por HTTPS, no se envía cross-site
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => $isHttps,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

// --- CONFIGURACIÓN (credenciales fuera del código fuente) ---
$config = require __DIR__ . '/config.php';
$host    = $config['db']['host'];
$db      = $config['db']['name'];
$user    = $config['db']['user'];
$pass    = $config['db']['pass'];
$charset = $config['db']['charset'];
$GOOGLE_CLIENT_ID = $config['google_client_id'];

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    // Error de conexión
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Error de conexión DB: ' . $e->getMessage()]);
    exit;
}

// --- RATE LIMITING (anti fuerza bruta en login/register) ---
$pdo->exec("CREATE TABLE IF NOT EXISTS login_attempts (
    identifier VARCHAR(191) PRIMARY KEY,
    attempts INT NOT NULL DEFAULT 0,
    last_attempt DATETIME NOT NULL
) ENGINE=InnoDB");

const RATE_LIMIT_MAX_ATTEMPTS = 8;
const RATE_LIMIT_WINDOW_MIN = 15;

function isRateLimited(PDO $pdo, string $identifier): bool {
    $stmt = $pdo->prepare("SELECT attempts, last_attempt FROM login_attempts WHERE identifier = ?");
    $stmt->execute([$identifier]);
    $row = $stmt->fetch();
    if (!$row) return false;

    $minutesSince = (time() - strtotime($row['last_attempt'])) / 60;
    if ($minutesSince > RATE_LIMIT_WINDOW_MIN) return false; // ventana expirada

    return $row['attempts'] >= RATE_LIMIT_MAX_ATTEMPTS;
}

function registerFailedAttempt(PDO $pdo, string $identifier): void {
    $stmt = $pdo->prepare("
        INSERT INTO login_attempts (identifier, attempts, last_attempt) VALUES (?, 1, NOW())
        ON DUPLICATE KEY UPDATE
            attempts = IF(last_attempt < DATE_SUB(NOW(), INTERVAL " . RATE_LIMIT_WINDOW_MIN . " MINUTE), 1, attempts + 1),
            last_attempt = NOW()
    ");
    $stmt->execute([$identifier]);
}

function clearRateLimit(PDO $pdo, string $identifier): void {
    $stmt = $pdo->prepare("DELETE FROM login_attempts WHERE identifier = ?");
    $stmt->execute([$identifier]);
}

// Identificador para el límite: IP (evita que un atacante pruebe usuarios ilimitados desde la misma IP)
$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

// Obtener la acción (GET o POST)
$action = $_GET['action'] ?? $_POST['action'] ?? '';


// --- LOGIN CON GOOGLE ---
if ($action === 'google_login') {
    $token = $_POST['credential'] ?? '';
    if (empty($token)) {
        echo json_encode(['status' => 'error', 'message' => 'No token provided']);
        exit;
    }

    // 1. Validar token con Google
    $url = "https://oauth2.googleapis.com/tokeninfo?id_token=" . $token;
    
    // Usamos @ para evitar warnings si falla la conexión
    $response = @file_get_contents($url);
    
    if ($response === FALSE) {
         echo json_encode(['status' => 'error', 'message' => 'Error al contactar a Google']);
         exit;
    }

    $payload = json_decode($response, true);

    // Validar que el token fue emitido PARA esta app (evita que un token de otra
    // app de Google sea aceptado aquí) y que el email está verificado por Google.
    $validAudience = $payload && isset($payload['aud']) && $payload['aud'] === $GOOGLE_CLIENT_ID;
    $emailVerified = $payload && (($payload['email_verified'] ?? 'false') === 'true' || $payload['email_verified'] === true);

    if (!$validAudience) {
        echo json_encode(['status' => 'error', 'message' => 'Token no corresponde a esta aplicación']);
        exit;
    }
    if (!$emailVerified) {
        echo json_encode(['status' => 'error', 'message' => 'Email de Google no verificado']);
        exit;
    }

    if ($payload && isset($payload['email'])) {
        $email = $payload['email'];

        // Obtener solo la parte antes del @ para mostrar
        $displayUsername = explode('@', $email)[0];
        
        // Usar el email completo como identificador único en la DB
        $dbUsername = $email; 
        
        // 2. Buscar/Registrar usuario en DB
        $stmt = $pdo->prepare("SELECT id, username FROM usertugasto WHERE username = ?");
        $stmt->execute([$dbUsername]);
        $user = $stmt->fetch();

        if (!$user) {
            // Registrar nuevo usuario de Google
            $hash = 'GOOGLE_AUTH_USER'; 
            $stmt = $pdo->prepare("INSERT INTO usertugasto (username, password, data) VALUES (?, ?, '{}')");
            
            if ($stmt->execute([$dbUsername, $hash])) {
                 $user = ['id' => $pdo->lastInsertId(), 'username' => $dbUsername];
            } else {
                 echo json_encode(['status' => 'error', 'message' => 'Error al registrar usuario Google']);
                 exit;
            }
        }
        
        // 3. Iniciar sesión
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $displayUsername; 
        
        echo json_encode(['status' => 'success', 'username' => $displayUsername]);

    } else {
        echo json_encode(['status' => 'error', 'message' => 'Token inválido o falta email']);
    }
    exit;
}


// --- VERIFICAR SESIÓN ---
if ($action === 'check_session') {
    if (isset($_SESSION['user_id'])) {
        echo json_encode(['status' => 'logged_in', 'username' => $_SESSION['username']]); 
    } else {
        echo json_encode(['status' => 'logged_out']);
    }
    exit;
}

// --- REGISTRO DE USUARIO ---
if ($action === 'register') {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';

    if (empty($username) || empty($password)) {
        echo json_encode(['status' => 'error', 'message' => 'Faltan datos']);
        exit;
    }

    if (isRateLimited($pdo, 'register:' . $clientIp)) {
        http_response_code(429);
        echo json_encode(['status' => 'error', 'message' => 'Demasiados intentos. Espera unos minutos e intenta de nuevo.']);
        exit;
    }

    registerFailedAttempt($pdo, 'register:' . $clientIp);

    $stmt = $pdo->prepare("SELECT id FROM usertugasto WHERE username = ?");
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        echo json_encode(['status' => 'error', 'message' => 'Usuario ya existe']);
        exit;
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("INSERT INTO usertugasto (username, password, data) VALUES (?, ?, '{}')");
    if ($stmt->execute([$username, $hash])) {
        $_SESSION['user_id'] = $pdo->lastInsertId();
        $_SESSION['username'] = $username;
        echo json_encode(['status' => 'success']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Error al registrar']);
    }
    exit;
}

// --- INICIO DE SESIÓN ---
if ($action === 'login') {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';

    if (isRateLimited($pdo, 'login:' . $clientIp)) {
        http_response_code(429);
        echo json_encode(['status' => 'error', 'message' => 'Demasiados intentos. Espera unos minutos e intenta de nuevo.']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT id, username, password FROM usertugasto WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password'])) {
        clearRateLimit($pdo, 'login:' . $clientIp);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        echo json_encode(['status' => 'success']);
    } else {
        registerFailedAttempt($pdo, 'login:' . $clientIp);
        echo json_encode(['status' => 'error', 'message' => 'Credenciales inválidas']);
    }
    exit;
}

// --- CERRAR SESIÓN ---
if ($action === 'logout') {
    session_destroy();
    echo json_encode(['status' => 'success']);
    exit;
}

// --- RUTAS PROTEGIDAS (Requieren Login) ---
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['status' => 'error', 'message' => 'No autorizado']);
    exit;
}

// --- PROXY PARA GOOGLE SHEETS (SOLUCIÓN CORS Y BLOQUEO DE GOOGLE) ---
if ($action === 'get_quotes') {
    $url = $_POST['url'] ?? '';

    // Validación básica: Solo permitir URLs de Google Sheets
    if (strpos($url, 'docs.google.com/spreadsheets') === false) {
         echo json_encode(['status' => 'error', 'message' => 'URL inválida. Solo se aceptan hojas de Google.']);
         exit;
    }

    // --- CORRECCIÓN IMPLEMENTADA: USAR cURL EN LUGAR DE file_get_contents ---
    // Inicializar cURL
    $ch = curl_init();
    
    // Configurar opciones
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true); // Devolver respuesta como string
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true); // Seguir redirecciones (IMPORTANTE para Sheets)
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Evitar problemas de certificados en hosting compartido
    curl_setopt($ch, CURLOPT_TIMEOUT, 10); // Tiempo máximo de espera
    
    // Falsificar User-Agent para parecer un navegador real (Chrome)
    // Esto evita que Google bloquee la petición automatizada
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // Ejecutar petición
    $csvContent = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    
    curl_close($ch);

    // Verificar errores
    if ($httpCode !== 200 || $csvContent === false) {
        $msg = "Error al conectar con Google. ";
        if ($curlError) $msg .= "Detalle: " . $curlError;
        else $msg .= "Código HTTP: " . $httpCode;
        
        echo json_encode(['status' => 'error', 'message' => $msg]);
        exit;
    }

    // Verificar que lo que recibimos parece un CSV y no una página de Login HTML
    if (strpos($csvContent, '<html') !== false || strpos($csvContent, '<!DOCTYPE') !== false) {
         echo json_encode(['status' => 'error', 'message' => 'Google devolvió HTML en lugar de CSV. Revisa que la hoja esté "Publicada en la Web".']);
         exit;
    }

    // Devolvemos el CSV dentro del JSON para que JS lo procese
    echo json_encode(['status' => 'success', 'data' => $csvContent]);
    exit;
}

// Obtener datos de usuario
if ($action === 'get_data') {
    $stmt = $pdo->prepare("SELECT data FROM usertugasto WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $result = $stmt->fetch();
    echo json_encode(['status' => 'success', 'data' => $result['data']]);
    exit;
}

// Guardar datos de usuario
if ($action === 'save_data') {
    $data = $_POST['data'] ?? '{}';

    // Límite de tamaño para evitar abuso de almacenamiento (2 MB es de sobra para este uso)
    if (strlen($data) > 2 * 1024 * 1024) {
        echo json_encode(['status' => 'error', 'message' => 'Los datos exceden el tamaño permitido']);
        exit;
    }

    // Validar que sea JSON bien formado antes de persistirlo
    json_decode($data);
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode(['status' => 'error', 'message' => 'Datos con formato inválido']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE usertugasto SET data = ? WHERE id = ?");
    $stmt->execute([$data, $_SESSION['user_id']]);
    echo json_encode(['status' => 'success']);
    exit;
}

// Manejo de acción no válida
http_response_code(400);
echo json_encode(['status' => 'error', 'message' => 'Acción no válida.']);
?>