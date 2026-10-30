# Guía de Instalación y Puesta en Marcha - LateSoft

Esta guía detalla el procedimiento paso a paso para clonar, configurar y ejecutar en entorno local tanto el backend Node.js + MySQL como la aplicación móvil React Native con Expo Router.

---

## 1. Requisitos Previos del Sistema

- **Node.js**: Versión `>= 20.x` (LTS recomendada, testeado en v20.x y v24.x).
- **npm**: Versión `>= 10.x`.
- **MySQL Server**: Versión `8.0` o superior (o MariaDB 10.5+). *Nota: para testing automatizado se utiliza SQLite en memoria sin requerir daemon externo.*
- **Git**: Para control de versiones.
- **Expo CLI / EAS CLI**: Instalable vía `npm install -g eas-cli expo`.
- **Dispositivo Móvil o Emulador**:
  - Emulador Android oficial con Android Studio (API 33+) o dispositivo Android físico con depuración USB habilitada.

---

## 2. Configuración y Puesta en Marcha del Backend

### 2.1 Instalación de dependencias
Abrí una terminal en la carpeta `backend/`:
```bash
cd backend
npm install
```

### 2.2 Variables de Entorno
Copia el archivo de ejemplo a `.env`:
```bash
cp .env.example .env
```
Editá `.env` configurando los accesos a tu base de datos MySQL local:
```env
PORT=3001
NODE_ENV=development

# Conexión a MySQL
DB_CLIENT=mysql2
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password_local
DB_NAME=latesoft_db

# Seguridad de Tokens
JWT_ACCESS_SECRET=clave_super_secreta_minimo_32_caracteres_latesoft_argentina
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=7

# OAuth (Opcionales en local)
GOOGLE_CLIENT_IDS=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

### 2.3 Creación de Base de Datos, Migraciones y Seeds
Asegurate de que el servicio de MySQL esté corriendo y creá la base de datos:
```sql
CREATE DATABASE latesoft_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Ejecutá las migraciones y los seeds automáticos con un solo comando:
```bash
npm run db:setup
```
*(Opcional: Si querés correr en desarrollo con base SQLite local sin MySQL, simplemente poné `DB_CLIENT=sqlite3` en tu `.env` y ejecutá `npm run db:setup`)*.

### 2.4 Ejecución de Pruebas Automatizadas
Para verificar que el RBAC, la rotación de tokens, el cálculo impositivo argentino y el aislamiento de sucursales funcionen al 100%:
```bash
npm test
```

### 2.5 Iniciar el Servidor de Desarrollo
```bash
npm run dev
```
La API estará lista y escuchando en `http://localhost:3001` (o la IP local de tu máquina).

---

## 3. Configuración y Ejecución de la App Móvil (Expo)

### 3.1 Instalación de dependencias
Abrí una nueva terminal en la carpeta `mobile/`:
```bash
cd mobile
npm install
```

### 3.2 Variables de Entorno
Copiá el archivo `.env.example` a `.env`:
```bash
cp .env.example .env
```
Configurá `EXPO_PUBLIC_API_URL`:
- **Si usás emulador Android Studio**: `http://10.0.2.2:3001` (apunta al localhost de la máquina anfitriona).
- **Si usás celular físico por Wi-Fi**: `http://192.168.1.XX:3001` (la IP local de tu PC en la red Wi-Fi).

Asegurate de dejar habilitado:
```env
EXPO_PUBLIC_ENABLE_DEV_SWITCHER=true
```
Esto activa el botón flotante en la esquina inferior derecha para alternar entre roles (Admin, Encargado, Cajero, Barista, Cliente) con login real de prueba.

### 3.3 Iniciar el Servidor Metro de Expo
```bash
npx expo start -c
```
Presioná `a` en la terminal para abrir directamente en el emulador de Android conectado, o escaneá el QR con la aplicación Expo Go / Development Build en tu dispositivo físico.
