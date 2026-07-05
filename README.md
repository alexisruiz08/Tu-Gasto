# TuGasto.com

App web gratuita para controlar gastos, ingresos y ahorros multimoneda (pesos, dólares, cripto). Frontend en HTML/CSS/JS vanilla, backend en PHP + MySQL.

## Stack

- **Frontend**: HTML + CSS + JavaScript vanilla (sin build step, sin frameworks). Íconos con [Lucide](https://unpkg.com/lucide) vía CDN.
- **Backend**: PHP con PDO (MySQL).
- **Auth**: usuario/contraseña propio (`password_hash`/`password_verify`) o Google Sign-In.
- **Persistencia de datos**: cada usuario tiene una sola columna `data` (JSON) en la tabla `usertugasto`, con un objeto por mes (`AAAA-MM`) más una sección `global` (moneda, billetera, presupuestos, etc).

## Estructura de archivos

| Archivo | Qué hace |
|---|---|
| `index.php` | Toda la interfaz (landing, login, dashboard, modales). |
| `script.js` | Toda la lógica de frontend: auth, dashboard, gastos, transferencias, reportes. |
| `styles.css` | Estilos. |
| `api.php` | Backend: login/registro, Google login, guardar/leer datos, proxy de cotizaciones, rate limiting. |
| `config.php` | Credenciales de DB y `GOOGLE_CLIENT_ID` (no se sube a git, ver más abajo). |
| `config.example.php` | Plantilla de `config.php` para nuevos despliegues. |
| `backup.php` | Genera un dump SQL de las tablas de usuario, pensado para correr por cron. |
| `htaccess` | Reglas de Apache: fuerza HTTPS y bloquea acceso directo a `config.php`. **Subir renombrado a `.htaccess`.** |
| `backups/htaccess` | Bloquea todo acceso HTTP a la carpeta de backups. **También subir como `.htaccess`.** |

## Poner en marcha un despliegue nuevo

1. Copiá `config.example.php` como `config.php` y completá:
   - Credenciales reales de la base de datos.
   - `google_client_id` (Google Cloud Console → OAuth Client ID).
   - `backup_secret`: una clave larga y random, solo necesaria si vas a disparar `backup.php` por HTTP en vez de por cron/CLI.
2. Creá la tabla de usuarios en MySQL (si no existe):
   ```sql
   CREATE TABLE usertugasto (
       id INT AUTO_INCREMENT PRIMARY KEY,
       username VARCHAR(191) UNIQUE NOT NULL,
       password VARCHAR(255) NOT NULL,
       data LONGTEXT NOT NULL DEFAULT '{}'
   );
   ```
   La tabla `login_attempts` (rate limiting) se crea sola la primera vez que corre `api.php`.
3. Subí `htaccess` **renombrado a `.htaccess`** (en la raíz) y `backups/htaccess` **renombrado a `.htaccess`** (dentro de esa carpeta). GitHub/el filesystem local los guarda sin el punto porque algunos entornos de desarrollo Windows no manejan bien archivos que empiezan con punto.
4. En Google Cloud Console, agregá el dominio real a los orígenes autorizados del Client ID.
5. Programá un cron (por ejemplo en cPanel → Cron Jobs) para correr `php backup.php` una vez por día. Se guardan los últimos 14 backups en `backups/` y se van borrando los más viejos solos.

## Seguridad ya implementada

- Credenciales fuera del código fuente (`config.php`, bloqueado por `.htaccess`).
- El login con Google valida `aud` (audience) y `email_verified` del token, no solo la firma.
- Cookies de sesión `httponly` + `samesite=Lax` + `secure` automático en HTTPS.
- Rate limiting: 8 intentos/15 min en login y registro; 60 req/min en los endpoints de datos ya autenticados.
- Validación de tamaño (2MB) y formato JSON en `save_data`.
- HTML escapado en la tabla de movimientos (previene XSS con descripciones/categorías maliciosas).
- Errores de conexión a la base no se muestran en detalle al cliente, solo se loguean en el servidor.

## Pendiente (a propósito, no implementado)

- **Recuperación de contraseña real** ("Olvidé mi contraseña" hoy solo muestra un aviso) — requiere infraestructura de envío de emails.
- Revisión legal de `terminos.php` / `privacidad.php`: el contenido es un borrador razonable, no reemplaza asesoría legal, sobre todo por manejar datos financieros de usuarios en Argentina/Uruguay.
