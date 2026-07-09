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
$ADMIN_EMAIL = $config['admin_email'];

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    // El detalle técnico queda solo en el log del servidor; al cliente no le
    // mostramos nada que pueda revelar estructura interna de la base de datos.
    error_log('TuGasto DB connection error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Error del servidor. Intenta de nuevo en unos minutos.']);
    exit;
}

// --- RATE LIMITING (anti fuerza bruta en login/register) ---
$pdo->exec("CREATE TABLE IF NOT EXISTS login_attempts (
    identifier VARCHAR(191) PRIMARY KEY,
    attempts INT NOT NULL DEFAULT 0,
    last_attempt DATETIME NOT NULL
) ENGINE=InnoDB");

// Límites para login/registro (pocos intentos, ventana larga: anti fuerza bruta)
const RATE_LIMIT_MAX_ATTEMPTS = 8;
const RATE_LIMIT_WINDOW_MIN = 15;

// Límite para endpoints de datos ya autenticados (más laxo, ventana corta: anti abuso/spam)
const API_RATE_LIMIT_MAX_ATTEMPTS = 60;
const API_RATE_LIMIT_WINDOW_MIN = 1;

function isRateLimited(PDO $pdo, string $identifier, int $maxAttempts = RATE_LIMIT_MAX_ATTEMPTS, int $windowMin = RATE_LIMIT_WINDOW_MIN): bool {
    $stmt = $pdo->prepare("SELECT attempts, last_attempt FROM login_attempts WHERE identifier = ?");
    $stmt->execute([$identifier]);
    $row = $stmt->fetch();
    if (!$row) return false;

    $minutesSince = (time() - strtotime($row['last_attempt'])) / 60;
    if ($minutesSince > $windowMin) return false; // ventana expirada

    return $row['attempts'] >= $maxAttempts;
}

function registerFailedAttempt(PDO $pdo, string $identifier, int $windowMin = RATE_LIMIT_WINDOW_MIN): void {
    $stmt = $pdo->prepare("
        INSERT INTO login_attempts (identifier, attempts, last_attempt) VALUES (?, 1, NOW())
        ON DUPLICATE KEY UPDATE
            attempts = IF(last_attempt < DATE_SUB(NOW(), INTERVAL $windowMin MINUTE), 1, attempts + 1),
            last_attempt = NOW()
    ");
    $stmt->execute([$identifier]);
}

function clearRateLimit(PDO $pdo, string $identifier): void {
    $stmt = $pdo->prepare("DELETE FROM login_attempts WHERE identifier = ?");
    $stmt->execute([$identifier]);
}

// Rate limit simple para endpoints de datos: cuenta llamadas sin bloquear por fallos,
// solo corta si se superan las N llamadas permitidas en la ventana.
function isApiRateLimited(PDO $pdo, string $identifier): bool {
    if (isRateLimited($pdo, $identifier, API_RATE_LIMIT_MAX_ATTEMPTS, API_RATE_LIMIT_WINDOW_MIN)) {
        return true;
    }
    registerFailedAttempt($pdo, $identifier, API_RATE_LIMIT_WINDOW_MIN);
    return false;
}

// Identificador para el límite: IP (evita que un atacante pruebe usuarios ilimitados desde la misma IP)
$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

// --- PANEL DE SUGERENCIAS (admin): tablas + conteo de no leídas ---
function ensureFeedbackTables(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        username VARCHAR(191) NOT NULL,
        mensaje TEXT NOT NULL,
        fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB");
    $pdo->exec("CREATE TABLE IF NOT EXISTS admin_meta (
        meta_key VARCHAR(64) PRIMARY KEY,
        meta_value VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB");
}

// Cuenta sugerencias mas nuevas que la ultima vez que el admin abrio el panel.
// Si nunca lo abrio, cuenta todo lo que haya.
function getUnreadFeedbackCount(PDO $pdo): int {
    ensureFeedbackTables($pdo);
    $stmt = $pdo->prepare("SELECT meta_value FROM admin_meta WHERE meta_key = 'last_seen_feedback'");
    $stmt->execute();
    $lastSeen = $stmt->fetchColumn();

    if ($lastSeen === false) {
        $stmt = $pdo->query("SELECT COUNT(*) FROM feedback");
    } else {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM feedback WHERE fecha > ?");
        $stmt->execute([$lastSeen]);
    }
    return (int) $stmt->fetchColumn();
}

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
        // Solo esta cuenta de Google exacta (validada por el token, no por el
        // username que eligió el usuario) tiene acceso al panel de sugerencias
        $_SESSION['is_admin'] = ($email === $ADMIN_EMAIL);

        echo json_encode(['status' => 'success', 'username' => $displayUsername]);

    } else {
        echo json_encode(['status' => 'error', 'message' => 'Token inválido o falta email']);
    }
    exit;
}


// --- VERIFICAR SESIÓN ---
if ($action === 'check_session') {
    if (isset($_SESSION['user_id'])) {
        $sessionIsAdmin = !empty($_SESSION['is_admin']);
        echo json_encode([
            'status' => 'logged_in',
            'username' => $_SESSION['username'],
            'is_admin' => $sessionIsAdmin,
            'unread_feedback' => $sessionIsAdmin ? getUnreadFeedbackCount($pdo) : 0,
        ]);
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

    // Los usuarios de Google se identifican internamente por su email completo;
    // si dejáramos registrar una cuenta local con un username en formato email,
    // alguien podría "ocupar" de antemano el email de otra persona (por ejemplo
    // el del admin) y terminar compartiendo esa misma cuenta al iniciar con Google.
    if (filter_var($username, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['status' => 'error', 'message' => 'El usuario no puede tener formato de email']);
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
        $_SESSION['is_admin'] = false; // el panel de sugerencias solo es accesible vía Google
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
        $_SESSION['is_admin'] = false; // el panel de sugerencias solo es accesible vía Google
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
    if (isApiRateLimited($pdo, 'get_data:' . $_SESSION['user_id'])) {
        http_response_code(429);
        echo json_encode(['status' => 'error', 'message' => 'Demasiadas solicitudes. Espera un momento.']);
        exit;
    }
    $stmt = $pdo->prepare("SELECT data FROM usertugasto WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $result = $stmt->fetch();
    echo json_encode(['status' => 'success', 'data' => $result['data']]);
    exit;
}

// Guardar datos de usuario
if ($action === 'save_data') {
    if (isApiRateLimited($pdo, 'save_data:' . $_SESSION['user_id'])) {
        http_response_code(429);
        echo json_encode(['status' => 'error', 'message' => 'Demasiadas solicitudes. Espera un momento.']);
        exit;
    }
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

// Recibe sugerencias/consejos de mejora de los usuarios (boton junto al de Ko-fi)
if ($action === 'submit_feedback') {
    if (isApiRateLimited($pdo, 'submit_feedback:' . $_SESSION['user_id'])) {
        http_response_code(429);
        echo json_encode(['status' => 'error', 'message' => 'Demasiadas solicitudes. Espera un momento.']);
        exit;
    }

    $mensaje = trim($_POST['mensaje'] ?? '');
    if ($mensaje === '') {
        echo json_encode(['status' => 'error', 'message' => 'Escribí algo antes de enviar']);
        exit;
    }
    if (mb_strlen($mensaje) > 2000) {
        echo json_encode(['status' => 'error', 'message' => 'El mensaje es demasiado largo']);
        exit;
    }

    ensureFeedbackTables($pdo);

    $stmt = $pdo->prepare("INSERT INTO feedback (user_id, username, mensaje) VALUES (?, ?, ?)");
    $stmt->execute([$_SESSION['user_id'], $_SESSION['username'], $mensaje]);
    echo json_encode(['status' => 'success']);
    exit;
}

// Panel de sugerencias: SOLO accesible para la cuenta de Google marcada como
// admin en config.php. Esta es la barrera real; ocultar el botón en el
// frontend es solo cosmético, esto es lo que efectivamente bloquea el acceso.
if ($action === 'get_feedback') {
    if (empty($_SESSION['is_admin'])) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'No autorizado']);
        exit;
    }

    if (isApiRateLimited($pdo, 'get_feedback:' . $_SESSION['user_id'])) {
        http_response_code(429);
        echo json_encode(['status' => 'error', 'message' => 'Demasiadas solicitudes. Espera un momento.']);
        exit;
    }

    ensureFeedbackTables($pdo);

    $stmt = $pdo->query("SELECT username, mensaje, fecha FROM feedback ORDER BY fecha DESC LIMIT 200");
    $rows = $stmt->fetchAll();
    echo json_encode(['status' => 'success', 'data' => $rows]);
    exit;
}

// El admin marca las sugerencias como vistas (apaga el puntito rojo). Guarda
// el momento actual; la próxima vez solo se cuentan como "nuevas" las que
// lleguen después de este instante.
if ($action === 'mark_feedback_seen') {
    if (empty($_SESSION['is_admin'])) {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'No autorizado']);
        exit;
    }

    ensureFeedbackTables($pdo);
    $stmt = $pdo->prepare("
        INSERT INTO admin_meta (meta_key, meta_value) VALUES ('last_seen_feedback', NOW())
        ON DUPLICATE KEY UPDATE meta_value = NOW()
    ");
    $stmt->execute();
    echo json_encode(['status' => 'success']);
    exit;
}

// Manejo de acción no válida
http_response_code(400);
echo json_encode(['status' => 'error', 'message' => 'Acción no válida.']);
?>