<?php
// backup.php
// Genera un dump SQL de las tablas de la app y borra los backups más viejos.
//
// Uso recomendado (cron de cPanel, corre por CLI, no expuesto a internet):
//   php /home/tu_usuario/ruta/a/Tu Gasto/backup.php
//
// Alternativa por HTTP (si tu hosting solo permite crons con URL/wget/curl):
//   https://tugasto.com/backup.php?key=LO_QUE_PUSISTE_EN_backup_secret
// En ese caso, la clave DEBE coincidir con config.php o se rechaza el pedido.

$config = require __DIR__ . '/config.php';

$isCli = PHP_SAPI === 'cli';
if (!$isCli) {
    $key = $_GET['key'] ?? '';
    if (!hash_equals((string) $config['backup_secret'], (string) $key)) {
        http_response_code(403);
        exit('Forbidden');
    }
}

$db = $config['db'];
$dsn = "mysql:host={$db['host']};dbname={$db['name']};charset={$db['charset']}";

try {
    $pdo = new PDO($dsn, $db['user'], $db['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (\PDOException $e) {
    error_log('TuGasto backup: error de conexión - ' . $e->getMessage());
    exit('Error de conexión a la base de datos.' . PHP_EOL);
}

$backupDir = __DIR__ . '/backups';
if (!is_dir($backupDir)) {
    mkdir($backupDir, 0755, true);
}

$tables = ['usertugasto', 'login_attempts'];
$timestamp = date('Y-m-d_His');
$filePath = "$backupDir/backup_$timestamp.sql";
$sql = "-- Backup TuGasto.com generado el " . date('c') . PHP_EOL;

foreach ($tables as $table) {
    $sql .= dumpTable($pdo, $table);
}

file_put_contents($filePath, $sql);

// Retener solo los últimos 14 backups para no llenar el disco del hosting
$backups = glob("$backupDir/backup_*.sql");
sort($backups);
$excedentes = count($backups) - 14;
if ($excedentes > 0) {
    foreach (array_slice($backups, 0, $excedentes) as $viejo) {
        unlink($viejo);
    }
}

$msg = "Backup creado: $filePath" . PHP_EOL;
echo $msg;
error_log('TuGasto backup: ' . $msg);

function dumpTable(PDO $pdo, string $table): string {
    $out = "-- Tabla: $table" . PHP_EOL;
    $rows = $pdo->query("SELECT * FROM `$table`")->fetchAll();

    foreach ($rows as $row) {
        $columns = array_map(fn($c) => "`$c`", array_keys($row));
        $values = array_map(function ($v) use ($pdo) {
            return $v === null ? 'NULL' : $pdo->quote($v);
        }, array_values($row));

        $out .= "INSERT INTO `$table` (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $values) . ");" . PHP_EOL;
    }

    return $out . PHP_EOL;
}
