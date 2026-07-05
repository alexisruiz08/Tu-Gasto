<?php
// config.example.php
// Copiá este archivo como config.php y completá tus valores reales.
// config.php NO se sube a git (ver .gitignore) para no exponer credenciales.

return [
    'db' => [
        'host'    => 'localhost',
        'name'    => 'nombre_de_tu_base',
        'user'    => 'usuario_db',
        'pass'    => 'password_db',
        'charset' => 'utf8mb4',
    ],
    'google_client_id' => 'tu-client-id.apps.googleusercontent.com',

    // Clave secreta para poder ejecutar backup.php via HTTP (cron externo).
    'backup_secret' => 'CAMBIAR_ESTA_CLAVE_POR_UNA_LARGA_Y_UNICA',
];
