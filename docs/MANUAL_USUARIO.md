# Manual de Usuario - LateSoft Cafeterías (Argentina)

Este manual documenta el uso de la aplicación móvil LateSoft para cada uno de los roles del sistema: **Cliente (CUSTOMER)**, **Cajero (CASHIER)**, **Barista (BARISTA)**, **Encargado de Sucursal (MANAGER)** y **Administrador General (ADMIN)**.

---

## 1. Experiencia del Cliente (CUSTOMER)

### 1.1 Registro e Inicio de Sesión
1. Abrí la aplicación LateSoft. Si es tu primera vez, tocá en **"Registrate acá"**.
2. Ingresá tu Nombre y Apellido, Correo electrónico, Celular y Contraseña (mínimo 8 caracteres).
3. Presioná **"Crear mi cuenta"**. Serás autenticado inmediatamente.
4. Si ya tenés cuenta, ingresá tu email y contraseña en la pantalla de login, o tocá en el botón de tu red social favorita (Google, Facebook o GitHub).

> **[Captura 01: Pantalla de Login y Registro del Cliente]**
> *(Ubicación recomendada: docs/screenshots/01_login_cliente.png)*

---

### 1.2 Selección de Sucursal y Menú
1. Al ingresar, la app solicitará permiso de ubicación (GPS) para sugerirte automáticamente la sucursal de LateSoft más cercana a vos en la ciudad.
2. Si estás en el local, podés tocar el botón con el ícono de **Código QR** en la esquina superior y apuntar la cámara al QR del mostrador o mesa para seleccionarla de inmediato.
3. Podés marcar sucursales como favoritas tocando el ícono de la **estrella**.
4. En la pantalla principal de la **Carta**, verás la barra superior con el nombre de la sucursal activa, su distancia en km y si se encuentra abierta.
5. Navegá entre las categorías (Café de Especialidad, Pastelería, Tostados, etc.) y tocá cualquier producto disponible para elegir cantidad y agregar notas personalizadas (ej. *"con leche de avena, sin azúcar"*).

> **[Captura 02: Selector de Sucursales por GPS/QR y Carta con Precios Locales]**
> *(Ubicación recomendada: docs/screenshots/02_sucursal_carta.png)*

---

### 1.3 Carrito y Confirmación de Pedido
1. Entrá a la pestaña **Carrito** para revisar tus ítems, cantidades y el desglose impositivo (Subtotal neto, IVA al 21% discriminado y Total final en pesos argentinos).
2. Seleccioná si tu pedido es **"Para llevar (Take Away)"** o para **"Consumir en el local"**.
3. Tocá **"Confirmar pedido para retirar"**. Tu pedido nacerá con estado `PENDING` y pago `UNPAID`.
4. Acercate a la caja de la sucursal cuando llegues para abonar en efectivo, tarjeta, QR o transferencia.

> **[Captura 03: Carrito con Desglose Impositivo Argentino y Confirmación]**
> *(Ubicación recomendada: docs/screenshots/03_carrito_checkout.png)*

---

### 1.4 Seguimiento en Tiempo Real (Live Tracking)
1. En la pestaña **"Mis Pedidos"**, el estado de tu comanda se actualiza en vivo cada 5 segundos mediante un indicador de 4 etapas:
   - **Paso 1 - Recibido**: Esperando pago en caja.
   - **Paso 2 - En preparación**: El barista ya está elaborando tu café.
   - **Paso 3 - ¡Listo para retirar!**: Tu comanda está servida en el mostrador.
   - **Paso 4 - Entregado**: Disfrutaste de tu pedido.

> **[Captura 04: Stepper de Seguimiento en Vivo del Pedido]**
> *(Ubicación recomendada: docs/screenshots/04_seguimiento_pedidos.png)*

---

## 2. Operación del Cajero (CASHIER)

### 2.1 Punto de Venta en Mostrador (POS)
1. Ingresá con tu usuario de cajero. La app abrirá directamente el módulo **Caja (POS)**.
2. Buscá productos por nombre o navegá por la grilla. Cada toque agrega una unidad a la comanda activa del mostrador.
3. Modificá cantidades o notas en la columna derecha.
4. Tocá **"Cobrar"**:
   - Elegí el medio de pago: **Efectivo**, **Tarjeta**, **QR Mercado Pago** o **Transferencia**.
   - En caso de **Efectivo**, ingresá el importe entregado por el cliente y el sistema calculará al instante el **vuelto exacto**.
5. Presioná **"Confirmar Cobro"**. El pedido pasa de inmediato al KDS de los baristas.

> **[Captura 05: Interfaz del POS de Caja con Cálculo de Vuelto]**
> *(Ubicación recomendada: docs/screenshots/05_cajero_pos.png)*

---

### 2.2 Cobro de Pedidos Generados desde la App
1. Tocá la pestaña superior **"Por cobrar en App"**.
2. Verás la lista de pedidos pendientes de pago de los clientes que están en el local.
3. Tocá **"Cobrar en caja"** sobre la comanda del cliente, seleccioná el medio de pago y confirmá.

> **[Captura 06: Lista de Pedidos de la App por Cobrar en Caja]**
> *(Ubicación recomendada: docs/screenshots/06_cajero_por_cobrar.png)*

---

## 3. Estación de Barista (BARISTA - KDS)

1. Ingresá con tu usuario de barista y colocá el dispositivo en posición **horizontal (apaisado)**.
2. La pantalla permanecerá **siempre encendida** gracias a `expo-keep-awake`.
3. El sistema monitorea en vivo cada 5 segundos: ante una nueva comanda pagada, el dispositivo vibrará (`expo-haptics`).
4. Avanzá el pedido con un solo toque:
   - De **Pendientes** a **En preparación**: tocá *"Comenzar a preparar"*.
   - De **En preparación** a **Listos**: tocá *"Marcar como Listo"*.
   - De **Listos** a **Entregado**: tocá *"Entregar al cliente"*.
5. Si te quedás sin algún insumo (ej. leche de almendras o granos descafeinados), tocá **"Pausar Producto"** en la esquina superior para suspenderlo en el menú de la sucursal al instante.

> **[Captura 07: KDS de 3 Columnas en Modo Horizontal con Alertas Hápticas]**
> *(Ubicación recomendada: docs/screenshots/07_barista_kds.png)*

---

## 4. Gestión del Encargado (MANAGER)

1. En la pestaña **"Menú"**: editá los precios de venta específicos de tu sucursal o activá/desactivá productos.
2. En la pestaña **"Personal"**: creá nuevos cajeros y baristas asignados a tu local, o dales la baja lógica.
3. En la pestaña **"Pedidos"**: visualizá comandas en curso y cancelá pedidos antes de su entrega ingresando obligatoriamente el motivo de cancelación.
4. En la pestaña **"Reportes"**: consultá la facturación neta, el total de IVA recaudado, el ticket promedio y los productos más vendidos de tu sucursal.

> **[Captura 08: Panel de Gestión y Reportes del Encargado de Sucursal]**
> *(Ubicación recomendada: docs/screenshots/08_encargado_panel.png)*

---

## 5. Panel del Administrador General (ADMIN)

1. En la pestaña **"Dashboard"**: compará las ventas y comandas de toda la cadena, o usá el selector para inspeccionar métricas de una sucursal específica.
2. En la pestaña **"Sucursales"**: creá nuevos locales indicando nombre, slug para QR, dirección, coordenadas GPS y alícuota de IVA.
3. En la pestaña **"Catálogo"**: administrá las categorías y los productos maestros de la marca.
4. En la pestaña **"Encargados"**: creá usuarios con rol `MANAGER` y asignalos a sus respectivas sucursales.

> **[Captura 09: Dashboard Comparativo Multi-Sucursal del Administrador]**
> *(Ubicación recomendada: docs/screenshots/09_admin_dashboard.png)*
