# Guía de Despliegue en la Nube y Generación de APK - LateSoft

Este documento detalla la infraestructura de despliegue en producción para el backend y la base de datos MySQL, la configuración de los proveedores OAuth, los comandos de compilación mediante Expo Application Services (EAS Build) y el procedimiento para publicar el APK en GitHub Releases.

---

## 1. Despliegue del Backend y MySQL en la Nube

Para que la aplicación móvil instalada en teléfonos físicos pueda comunicarse con la API desde cualquier conexión de datos móviles o Wi-Fi, el backend y MySQL deben estar alojados en un hosting accesible públicamente con **HTTPS**.

### 1.1 Plataformas Cloud Recomendadas (Opciones Vigentes)
1. **Railway (Recomendado)**:
   - Permite crear un servicio de **MySQL 8** nativo con un solo clic (incluye almacenamiento persistente y variables de conexión automáticas).
   - Servicio Node.js conectado directamente al repositorio GitHub con despliegues automáticos ante cada push.
   - Provee subdominio HTTPS gratuito (ej. `https://latesoft-api.up.railway.app`).
2. **Render**:
   - Web Service para Node.js con HTTPS gratuito.
   - Soporte para MySQL gestionado o mediante instancia de Aiven / PlanetScale.
3. **VPS Propio (Ubuntu 22.04 / 24.04 en DigitalOcean o Hetzner)**:
   - Nginx como reverse proxy con certificado SSL gratuito vía Let's Encrypt (`certbot`).
   - PM2 para gestión de procesos Node.js y MySQL Server local.

### 1.2 Variables de Entorno en el Servidor de Producción
Configurá en el panel de tu hosting las siguientes variables (ningún secreto va en la app móvil):
```env
PORT=3001
NODE_ENV=production

# Conexión MySQL de Producción
DB_CLIENT=mysql2
DB_HOST=containers-us-west-XX.railway.app
DB_PORT=XXXX
DB_USER=root
DB_PASSWORD=secret_generado_por_hosting
DB_NAME=railway
DB_SSL=true

# Seguridad Criptográfica
JWT_ACCESS_SECRET=clave_aleatoria_produccion_de_al_menos_64_caracteres_hexadecimales
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=7

# Credenciales de Proveedores OAuth
GOOGLE_CLIENT_IDS=123456789-web.apps.googleusercontent.com,123456789-android.apps.googleusercontent.com
FACEBOOK_APP_ID=123456789012345
FACEBOOK_APP_SECRET=meta_app_secret_privado_del_servidor
GITHUB_CLIENT_ID=Ov23liXXXXXXXXXX
GITHUB_CLIENT_SECRET=github_client_secret_privado_del_servidor
```

### 1.3 Ejecución de Migraciones y Seeds en Producción
Antes del primer despliegue, compilá el backend. En producción ejecutá solo las migraciones; el seed contiene cuentas y datos de demostración, está bloqueado en producción y no debe ejecutarse sobre datos reales:
```bash
npm run build
npm run migrate
```
Esto inicializará las tablas InnoDB, las claves foráneas y el trigger de exclusividad. Para crear la primera cuenta administradora, definí `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` como variables temporales del servicio (la contraseña debe tener al menos 16 caracteres) y ejecutá una sola vez:
```bash
npm run bootstrap:admin
```
El comando se detiene si ya existe un administrador o si el correo ya está usado. Quitá las dos variables temporales después de crearlo. Luego cargá las sucursales y el catálogo desde la app con esa cuenta.

---

## 2. Configuración de Proveedores OAuth (Google, Facebook, GitHub)

> **REGLA DE SEGURIDAD INNEGOCIABLE:** Los `client_secret` de Facebook y GitHub **NUNCA** se colocan en el código ni en el `.env` de la aplicación móvil. Permanecen estrictamente en el backend. La app solo almacena Client IDs públicos.

### 2.1 Google Sign-In
1. Ingresá a [Google Cloud Console](https://console.cloud.google.com/) y creá un proyecto: `LateSoft Cafeterías`.
2. En **Pantalla de Consentimiento OAuth**, seleccioná tipo *Externo* y completá nombre y correo de soporte.
3. En **Credenciales**, creá dos credenciales:
   - **ID de cliente de OAuth Web**: Utilizado para intercambiar el ID Token en React Native. Obtenés el `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
   - **ID de cliente de OAuth Android**: Ingresá el nombre del paquete `com.latesoft.cafeteria` y la huella digital **SHA-1** de firma:
     - Obtené la huella SHA-1 de EAS ejecutando: `eas credentials -p android`.
4. Cargá ambos IDs separados por coma en la variable `GOOGLE_CLIENT_IDS` del backend.

### 2.2 Facebook Login (Meta for Developers)
1. Ingresá a [Meta for Developers](https://developers.facebook.com/) y creá una app de tipo *Consumidor*.
2. En la configuración básica, agregá la plataforma **Android**:
   - Nombre de paquete de Google Play: `com.latesoft.cafeteria`.
   - Hashes de claves: Obtené el Key Hash en base64 convirtiendo tu huella SHA-1 de EAS:
     ```bash
     echo "HUELLA_SHA1_HEX" | xxd -r -p | openssl base64
     ```
3. Copiá el `App ID` en `EXPO_PUBLIC_FACEBOOK_APP_ID` (móvil) y en `FACEBOOK_APP_ID` (backend).
4. Copiá el `App Secret` únicamente en `FACEBOOK_APP_SECRET` del backend.
5. **Requisito Obligatorio de Evaluación:** En el menú lateral *Roles de la App* $\to$ *Funciones*, agregá al docente o evaluador como **Tester** mediante su correo o usuario de Facebook para que pueda iniciar sesión sin que la app esté en modo Live público.

### 2.3 GitHub OAuth App
1. Ingresá a GitHub $\to$ **Settings** $\to$ **Developer Settings** $\to$ **OAuth Apps** $\to$ *New OAuth App*.
2. Datos:
   - Application Name: `LateSoft Cafeterías`
   - Homepage URL: `https://latesoft.com.ar`
   - Authorization callback URL: `latesoft://auth/callback`
3. Obtené el `Client ID` y colocalo en `EXPO_PUBLIC_GITHUB_CLIENT_ID` y en el backend.
4. Generá un nuevo `Client Secret` y colocalo **exclusivamente en el backend** (`GITHUB_CLIENT_SECRET`).

---

## 3. Generación del APK Instalable con EAS Build

### 3.1 Inicio de Sesión en Expo
```bash
cd mobile
eas login
```

### 3.2 Configuración del Proyecto en EAS
```bash
eas project:init
```

### 3.3 Compilación del APK Instalable (Perfil Preview)
Para generar el archivo `.apk` autónomo (no requiere Android Studio ni Google Play):
```bash
eas build -p android --profile preview
```
1. EAS compilará el código nativo con los plugins de cámara, ubicación y splash en sus servidores cloud.
2. Al finalizar, la terminal te entregará una URL de descarga directa del archivo `.apk` y un código QR para descargarlo inmediatamente en tu teléfono Android.

### 3.4 Compilación de Desarrollo (Perfil Development Client)
Para probar cambios en vivo con hot-reload en un dispositivo físico con módulos nativos:
```bash
eas build -p android --profile development
```

---

## 4. Publicación del APK en GitHub Releases

Para que cualquier usuario, docente o evaluador pueda descargar el instalable con un solo clic:
1. En tu repositorio de GitHub, ingresá a la sección **Releases** $\to$ **Draft a new release**.
2. En **Tag version**, colocá `v1.0.0` y creá el tag.
3. En **Release title**, colocá `LateSoft Cafeterías v1.0.0 - APK Instalable`.
4. En la descripción, incluí:
   - Enlace a la documentación (`MANUAL_USUARIO.md`).
   - Lista de usuarios y credenciales de prueba preconfiguradas.
   - Enlace a la API desplegada en producción.
5. Arrastrá y adjuntá el archivo `latesoft-cafeteria-v1.0.0.apk` descargado de EAS Build.
6. Presioná **Publish release**.

---

## 5. Checklist de Verificación en un Celular Android Real

- [ ] **Instalación:** El archivo APK se instala correctamente en un dispositivo Android físico sin advertencias bloqueantes.
- [ ] **Persistencia:** Se inicia sesión como cliente, se cierra la aplicación por completo desde la multitarea de Android, se vuelve a abrir y la sesión continúa activa de forma inmediata sin solicitar credenciales.
- [ ] **Geolocalización GPS:** Al abrir la app, solicita el permiso de ubicación con la justificación clara en español y calcula la distancia precisa en kilómetros a las sucursales reales de Buenos Aires.
- [ ] **Escaneo QR:** Al tocar el escáner de sucursal, abre la cámara y reconoce el código QR seleccionando la sucursal al instante.
- [ ] **Flujo de Pedido Completo (End-to-End):**
  1. El cliente arma un pedido en la app y lo confirma (`PENDING` y `UNPAID`).
  2. En el dispositivo del cajero, el pedido aparece en la pestaña *"Por cobrar en App"*.
  3. El cajero cobra la comanda seleccionando medio de pago.
  4. En menos de 5 segundos, la comanda ingresa al KDS del barista con vibración háptica.
  5. El barista avanza el pedido a *En preparación* y luego a *Listo*.
  6. En la app del cliente, el stepper de seguimiento visual se actualiza automáticamente a *"¡Listo para retirar!"*.
- [ ] **Manejo Offline:** Se desactiva el Wi-Fi y los datos móviles en el celular; la app muestra inmediatamente el banner descriptivo de falta de conexión sin romper la interfaz.
