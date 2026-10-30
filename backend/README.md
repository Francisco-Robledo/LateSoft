# Documentación Técnica de la API REST - LateSoft Backend

API RESTful desarrollada con **Node.js**, **Express**, **TypeScript**, **Knex** y **MySQL 8** (con compatibilidad de testing para SQLite). Diseñada con arquitectura modular, control de acceso basado en roles (RBAC) y aislamiento estricto por sucursal (tenant isolation).

---

## 1. Esquema de Autenticación y Seguridad

### 1.1 Formato de Cabecera
Todas las peticiones a endpoints protegidos deben incluir el Access Token en el encabezado HTTP:
```http
Authorization: Bearer <ACCESS_TOKEN>
```

### 1.2 Tipos de Tokens
- **Access Token (JWT)**: Vida útil de 15 minutos (`15m`). Carga útil firmada con `JWT_ACCESS_SECRET`:
  ```json
  {
    "sub": 1,
    "role": "CUSTOMER",
    "branchId": null,
    "iat": 1729868400,
    "exp": 1729869300
  }
  ```
- **Refresh Token**: Cadena opaca y aleatoria de 80 caracteres hexadecimales. Vida útil de 7 días. Se almacena únicamente su hash SHA-256 en la base de datos.
- **Rotación y Detección de Reutilización (Reuse Detection)**: Cada uso de `POST /auth/refresh` invalida el token actual y entrega uno nuevo manteniendo el mismo `family_id`. Si se detecta el uso de un token ya consumido, se revoca inmediatamente toda la familia de tokens asociada a la sesión.

---

## 2. Formato Unificado de Respuestas de Error

Todos los errores retornados por la API siguen estrictamente la misma estructura:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos enviados contienen errores de validación",
    "details": [
      {
        "path": "email",
        "message": "El correo electrónico no es válido"
      }
    ]
  }
}
```

### Tabla General de Códigos de Error HTTP

| Código HTTP | Error Code | Causa habitual |
| :---: | :--- | :--- |
| **400** | `VALIDATION_ERROR` | Parámetros o cuerpo de la petición no superan el esquema Zod. |
| **401** | `UNAUTHORIZED` | Token inexistente, inválido, expirado o reutilizado. Credenciales erróneas. |
| **403** | `FORBIDDEN` | Rol insuficiente o intento de acceso cruzado a datos de otra sucursal (IDOR). |
| **404** | `NOT_FOUND` | Recurso o endpoint inexistente. |
| **409** | `CONFLICT` | Registro duplicado de email, slug o identificador único. |
| **422** | `UNPROCESSABLE_ENTITY` | Transición ilegal de estado de pedido o pedido no pagado al preparar. |
| **429** | `TOO_MANY_REQUESTS` | Límite de tasa de peticiones excedido (Rate Limit). |
| **500** | `INTERNAL_SERVER_ERROR` | Error imprevisto en el servidor. |

---

## 3. Catálogo Detallado de Endpoints

### 3.1 Módulo Autenticación (`/auth`)

#### `POST /auth/register`
- **Roles:** Público.
- **Cuerpo:**
  ```json
  {
    "fullName": "Martín Palermo",
    "email": "martin@ejemplo.com",
    "password": "Password123!",
    "phone": "+54 11 4444-5555"
  }
  ```
- **Nota:** Todo registro público crea invariablemente un `CUSTOMER`.
- **Respuesta (201):**
  ```json
  {
    "user": {
      "id": 10,
      "fullName": "Martín Palermo",
      "email": "martin@ejemplo.com",
      "role": "CUSTOMER",
      "branchId": null,
      "phone": "+54 11 4444-5555"
    },
    "accessToken": "eyJhbGciOiJIUzI1Ni...",
    "refreshToken": "a4f89b91c7849e7823b4..."
  }
  ```

#### `POST /auth/login`
- **Roles:** Público.
- **Cuerpo:** `{ "email": "admin@latesoft.com.ar", "password": "Password123!" }`
- **Respuesta (200):** `{ user, accessToken, refreshToken }`

#### `POST /auth/social`
- **Roles:** Público.
- **Cuerpo:**
  ```json
  {
    "provider": "GOOGLE",
    "idToken": "eyJhbGciOi..."
  }
  ```
  *(O `provider: "FACEBOOK", "accessToken": "..."` o `provider: "GITHUB", "code": "..."`)*
- **Respuesta (200):** `{ user, accessToken, refreshToken }`
- **Seguridad:** Si el email pertenece a un usuario Staff o Admin, retorna `403 FORBIDDEN`.

#### `POST /auth/refresh`
- **Roles:** Público.
- **Cuerpo:** `{ "refreshToken": "a4f89b91c7849e7823b4..." }`
- **Respuesta (200):** `{ "accessToken": "...", "refreshToken": "..." }`

#### `POST /auth/logout`
- **Roles:** Autenticado.
- **Cuerpo:** `{ "refreshToken": "..." }`
- **Respuesta (200):** `{ "message": "Sesión cerrada correctamente" }`

#### `GET /auth/me`
- **Roles:** Autenticado.
- **Respuesta (200):** `{ "user": { "id": 1, "fullName": "Santiago Ramos", "email": "...", "role": "ADMIN", "branchId": null, "phone": "..." } }`

---

### 3.2 Módulo Sucursales (`/branches`)

#### `GET /branches`
- **Roles:** Público.
- **Query:** `activeOnly` (true/false, default true).
- **Respuesta (200):** `{ "data": [ { "id": 1, "name": "LateSoft Palermo Soho", "slug": "palermo-soho", "address": "...", "latitude": -34.5885, "longitude": -58.4305, "phone": "...", "opening_hours": { ... }, "is_open": true, "tax_rate": 21.00 } ] }`

#### `GET /branches/:id`
- **Roles:** Público.
- **Parámetro:** ID numérico o slug.

#### `GET /branches/:id/menu`
- **Roles:** Público.
- **Respuesta (200):** Retorna la carta completa de la sucursal agrupada por categorías, con sus precios locales y disponibilidad:
  ```json
  {
    "branch": { "id": 1, "name": "LateSoft Palermo Soho" },
    "menu": [
      {
        "id": 1,
        "name": "Café de Especialidad",
        "icon": "coffee",
        "items": [
          {
            "branch_product_id": 1,
            "product_id": 1,
            "name": "Espresso Doble",
            "price": 2200.00,
            "is_available": true,
            "paused_reason": null
          }
        ]
      }
    ]
  }
  ```

#### `POST /branches/:id/menu/:productId`
- **Roles:** `MANAGER` (de esa sucursal), `ADMIN`.
- **Cuerpo:** `{ "price": 2500.00, "isAvailable": true }`

#### `PATCH /branches/:id/menu/:productId/availability`
- **Roles:** `BARISTA` (de esa sucursal), `MANAGER` (de esa sucursal), `ADMIN`.
- **Cuerpo:** `{ "isAvailable": false, "pausedReason": "Sin leche de almendras" }`

---

### 3.3 Módulo Pedidos (`/orders`)

#### `POST /orders`
- **Roles:** `CUSTOMER`, `CASHIER`, `ADMIN`.
- **Cuerpo:**
  ```json
  {
    "branchId": 1,
    "orderType": "TAKE_AWAY",
    "notes": "Sin azúcar por favor",
    "paymentMethod": "CASH",
    "items": [
      { "branchProductId": 1, "quantity": 2, "notes": "Con hielo extra" }
    ]
  }
  ```
- **Lógica:** Precios calculados estrictamente en el backend. Tasa de IVA según sucursal. Asignación atómica de `order_number` secuencial diario.

#### `GET /orders`
- **Roles:** Autenticado.
- **Regla:** `CUSTOMER` solo ve sus pedidos; `CASHIER`, `BARISTA` y `MANAGER` solo ven pedidos de su sucursal; `ADMIN` ve todos.

#### `POST /orders/:id/pay`
- **Roles:** `CASHIER` (de esa sucursal), `ADMIN`.
- **Cuerpo:** `{ "paymentMethod": "CASH" }` *(CASH | CARD | QR | TRANSFER)*.

#### `PATCH /orders/:id/status`
- **Roles:** `BARISTA`, `CASHIER`, `MANAGER`, `ADMIN`.
- **Cuerpo:** `{ "status": "PREPARING" }` *(PREPARING | READY | DELIVERED | CANCELLED)*.

#### `GET /orders/kds`
- **Roles:** `BARISTA`, `MANAGER`, `ADMIN`.
- **Respuesta:** Pedidos pagados en curso (`PENDING`, `PREPARING`, `READY`) para la pantalla de cocina.

---

### 3.4 Módulo Reportes (`/reports`)

#### `GET /reports/sales`
- **Roles:** `MANAGER` (su sucursal), `ADMIN` (cualquiera o global).
- **Query:** `branchId`, `from` (YYYY-MM-DD), `to` (YYYY-MM-DD).
- **Respuesta (200):**
  ```json
  {
    "summary": {
      "totalOrders": 142,
      "totalRevenue": 485200.00,
      "totalTax": 84208.26,
      "totalNet": 400991.74,
      "averageTicket": 3416.90
    },
    "salesByDate": [],
    "paymentBreakdown": [],
    "branchComparison": []
  }
  ```

#### `GET /reports/top-products`
- **Roles:** `MANAGER`, `ADMIN`.
- **Query:** `branchId`, `from`, `to`, `limit`.

---

## 4. Usuarios de Prueba Preconfigurados (Seeds)

Contraseña común para desarrollo: `Password123!`

| Rol | Correo Electrónico | Sucursal Asignada |
| :--- | :--- | :--- |
| **ADMIN** | `admin@latesoft.com.ar` | Ninguna (Acceso global) |
| **MANAGER** | `manager.palermo@latesoft.com.ar` | LateSoft Palermo Soho (ID 1) |
| **MANAGER** | `manager.belgrano@latesoft.com.ar` | LateSoft Belgrano R (ID 2) |
| **CASHIER** | `cajero.palermo@latesoft.com.ar` | LateSoft Palermo Soho (ID 1) |
| **BARISTA** | `barista.palermo@latesoft.com.ar` | LateSoft Palermo Soho (ID 1) |
| **CUSTOMER** | `cliente@gmail.com` | Ninguna (Cliente frecuente) |
