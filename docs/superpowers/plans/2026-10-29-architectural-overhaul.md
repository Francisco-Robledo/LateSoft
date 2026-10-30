# Plan de Evolución Arquitectónica y Operativa de LateSoft (Prioridades 1, 2 y 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar una evolución integral sobre LateSoft resolviendo las tres prioridades críticas de una cafetería de especialidad real: (1) Operativa de tienda con Manager Override por PIN y Turnos/Arqueo de caja, (2) Identidad flexible con staff polivalente multi-sucursal y Log de auditoría para superpermisos, y (3) Fidelización por puntos para clientes y gobernanza de precios locales con límites y trazabilidad.

**Architecture:** 
Se introduce un esquema de base de datos ampliado y retrocompatible en SQLite/MySQL mediante Knex:
1. `pin_hash` en usuarios de staff y endpoint seguro de anulación con override por PIN de encargado sin desloguear al cajero.
2. Nueva tabla `cash_shifts` para control de aperturas, cierres ciegos y arqueos de caja con desglose por medio de pago (efectivo, tarjeta, QR).
3. Nueva tabla `staff_branch_assignments` para permitir empleados multi-sucursal y polivalentes (Cajero + Barista), junto con `audit_logs` para registrar de forma inmutable toda acción sensible (anulaciones, cambios de precio, overrides).
4. Sistema de fidelización con saldo de puntos (`loyalty_points`) calculado por compras y redimible en checkout, más reglas de negocio para impedir discrepancias abusivas en precios locales frente al catálogo maestro.
5. En frontend (Expo/React Native), se construyen modales e interfaces usando estrictamente el `PopupContext` (prohibido `Alert.alert`).

**Tech Stack:** Node.js, Express, TypeScript, Knex, SQLite / MySQL, bcryptjs, Zod, React Native / Expo, Jest, Supertest.

**Spec:** Especificación derivada de la auditoría de negocio gastronómico y feedback del usuario sobre vacíos en el MVP.

## Global Constraints
- Prohibido el uso de `Alert.alert`, `window.alert` o `window.confirm`. Toda confirmación o aviso debe usar `PopupProvider` / `usePopup()`.
- Respetar los cálculos matemáticos fiscales oficiales de Argentina (IVA incluido y desglosado con redondeo a 2 decimales).
- Mantener compatibilidad con los tests existentes de suite (`backend/tests`).
- Todas las rutas sensibles deben validar esquemas con Zod y manejar errores de forma centralizada con códigos HTTP correctos.

## Review Focus
1. **Intento de anulación con PIN incorrecto o PIN de un usuario sin rol de encargado:** Debe responder 403 / 401 y registrarse el intento.
2. **Cierre de turno con descuadre de efectivo:** El sistema debe calcular y guardar la diferencia (`cash_difference`), permitiendo notas explicativas del cajero/encargado.
3. **Empleado polivalente en dos locales:** La resolución de permisos debe validar que el empleado realmente tenga asignación vigente en la sucursal donde intenta operar.
4. **Desvío de precio local fuera del rango permitido:** El backend debe rechazar un precio que supere el margen de tolerancia (ej: $\pm 20\%$) configurado sobre el catálogo maestro.
5. **Canje de puntos sin saldo suficiente:** El checkout debe validar en servidor que el cliente posea los puntos que intenta aplicar antes de descontar el total de la orden.

---

## Tareas de Implementación

### Tarea 1: Migraciones de Base de Datos para las 3 Prioridades
**Files:**
- Create: `backend/src/db/migrations/20261029_002_architectural_overhaul.ts`
- Modify: `backend/src/db/seeds/001_initial_data.ts`
- Test: `backend/tests/migrations.test.ts`

- [x] **Paso 1.1:** Escribir migración Knex agregando:
  - Columna `pin_hash` (nullable, string 255) a `users` para staff y encargados.
  - Tabla `cash_shifts`: `id`, `branch_id`, `opened_by_id`, `closed_by_id`, `opened_at`, `closed_at`, `initial_cash`, `final_cash_expected`, `final_cash_counted`, `cash_difference`, `notes`, `status` ('OPEN' | 'CLOSED').
  - Tabla `staff_branch_assignments`: `id`, `user_id`, `branch_id`, `roles` (json string o listado de roles autorizados), `is_primary`, `is_active`.
  - Tabla `audit_logs`: `id`, `user_id`, `branch_id`, `action`, `entity_type`, `entity_id`, `details` (json), `ip_address`, `created_at`.
  - Tabla `customer_loyalty`: `id`, `customer_id`, `points_balance`, `lifetime_points`, `updated_at`.
  - Tabla `price_change_logs`: `id`, `branch_id`, `product_id`, `changed_by_id`, `old_price`, `new_price`, `reason`, `created_at`.
- [x] **Paso 1.2:** Actualizar el seed `001_initial_data.ts` para asignar PINs iniciales (`1234`) a managers y cajeros, y poblar asignaciones iniciales.
- [x] **Paso 1.3:** Ejecutar migración y seed en `dev.sqlite3` y verificar integridad referencial.

---

### Tarea 2: Manager Override con PIN en Cancelaciones (Backend y Tests)
**Files:**
- Create: `backend/src/modules/orders/orders.override.service.ts`
- Modify: `backend/src/modules/orders/orders.routes.ts`
- Modify: `backend/src/modules/orders/orders.controller.ts`
- Modify: `backend/src/modules/orders/orders.schema.ts`
- Test: `backend/tests/orders_override.test.ts`

- [x] **Paso 2.1:** Crear test unitario/integración `orders_override.test.ts` probando anulación con PIN correcto, PIN incorrecto, PIN de otra sucursal, y verificación de log de auditoría.
- [x] **Paso 2.2:** Definir esquema `overrideCancelOrderSchema` con `{ managerPin: string, reason: string }`.
- [x] **Paso 2.3:** Implementar `overrideCancel` en el controlador y servicio: buscar managers de la sucursal (o admins globales), comparar PIN con `bcrypt.compare`, cambiar estado de orden a `CANCELLED`, registrar en `audit_logs`.
- [x] **Paso 2.4:** Ejecutar tests y verificar que pasen con código 200.

---

### Tarea 3: Manager Override con PIN en Mobile (POS y KDS)
**Files:**
- Create: `mobile/src/components/ManagerPinModal.tsx`
- Modify: `mobile/app/(staff)/pos.tsx`
- Modify: `mobile/app/(staff)/kds.tsx`
- Modify: `mobile/src/api/client.ts`

- [x] **Paso 3.1:** Crear componente `ManagerPinModal` con teclado numérico ágil, input para motivo de cancelación y soporte de errores visuales mediante `PopupProvider`.
- [x] **Paso 3.2:** Integrar el modal en `pos.tsx` y `kds.tsx`: cuando el cajero o barista pulsa "Cancelar pedido", se despliega el modal solicitando el PIN del encargado.
- [x] **Paso 3.3:** Conectar con `POST /orders/:id/override-cancel` y refrescar la lista de pedidos tras la cancelación exitosa.

---

### Tarea 4: Módulo de Turnos y Arqueo de Caja (Backend)
**Files:**
- Create: `backend/src/modules/shifts/shifts.routes.ts`
- Create: `backend/src/modules/shifts/shifts.controller.ts`
- Create: `backend/src/modules/shifts/shifts.service.ts`
- Create: `backend/src/modules/shifts/shifts.schema.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/shifts.test.ts`

- [x] **Paso 4.1:** Escribir tests en `backend/tests/shifts.test.ts`: apertura de turno con fondo inicial, cálculo automático de cobros en efectivo durante el turno, cierre con arqueo (efectivo contado vs esperado) y cálculo de diferencia.
- [x] **Paso 4.2:** Implementar `shifts.service.ts` con métodos `openShift`, `getCurrentShift`, `closeShift`.
- [x] **Paso 4.3:** Crear rutas `/shifts/current`, `/shifts/open`, `/shifts/:id/close` protegidas por rol de Staff (`CASHIER`, `MANAGER`, `ADMIN`).
- [x] **Paso 4.4:** Ejecutar `npm test` y validar que todos los casos de prueba pasen.

---

### Tarea 5: Interfaz de Turno y Arqueo de Caja en Mobile
**Files:**
- Create: `mobile/app/(staff)/shift.tsx`
- Modify: `mobile/app/(staff)/_layout.tsx`
- Modify: `mobile/app/(staff)/pos.tsx`
- Modify: `mobile/app/(staff)/manager.tsx`

- [x] **Paso 5.1:** Crear pantalla `shift.tsx` con pestañas para Estado del Turno, Apertura de Caja (monto inicial) y Cierre/Arqueo de Turno (conteo de billetes/efectivo, comparación con el sistema, cálculo de diferencia y notas).
- [x] **Paso 5.2:** Enlazar acceso al turno desde el POS y el Panel de Manager.
- [x] **Paso 5.3:** Si no hay un turno abierto en la sucursal, advertir amigablemente en el POS antes de comenzar a cobrar.

---

### Tarea 6: Staff Polivalente y Log de Auditoría
**Files:**
- Create: `backend/src/modules/audit/audit.service.ts`
- Create: `backend/src/modules/audit/audit.routes.ts`
- Modify: `backend/src/middlewares/auth.ts`
- Modify: `backend/src/modules/users/users.service.ts`
- Test: `backend/tests/audit_and_assignments.test.ts`

- [x] **Paso 6.1:** Escribir tests para asignaciones multi-sucursal y verificación de registros en `audit_logs`.
- [x] **Paso 6.2:** Actualizar middleware `authorize` para chequear roles en `staff_branch_assignments` si existen asignaciones dinámicas.
- [x] **Paso 6.3:** Crear servicio centralizado `auditService.logAction(userId, branchId, action, entityType, entityId, details)` y conectar en anulaciones, cambios de precios y cierres de caja.
- [x] **Paso 6.4:** Crear ruta `GET /audit` accesible para `ADMIN` para consultar el historial de auditoría de la cadena.

---

### Tarea 7: Fidelización de Clientes (Puntos) y Límites de Precios
**Files:**
- Create: `backend/src/modules/loyalty/loyalty.routes.ts`
- Create: `backend/src/modules/loyalty/loyalty.service.ts`
- Modify: `backend/src/modules/orders/orders.service.ts`
- Modify: `backend/src/modules/products/products.service.ts`
- Modify: `mobile/app/(customer)/cart.tsx`
- Modify: `mobile/app/(customer)/profile.tsx`
- Modify: `mobile/app/(admin)/catalog.tsx`
- Modify: `mobile/app/(staff)/manager.tsx`
- Test: `backend/tests/loyalty_and_pricing.test.ts`

- [x] **Paso 7.1:** Escribir tests para acreditación de puntos tras pago de orden ($1 punto por cada $100 ARS) y canje en nueva orden.
- [x] **Paso 7.2:** Escribir tests para validación de precios locales en `branch_products`: rechazar si el precio difiere más del $\pm 20\%$ del precio base del catálogo maestro sin autorización del Admin.
- [x] **Paso 7.3:** Implementar endpoints de puntos (`GET /loyalty/me`) y soporte de canje en `POST /orders`.
- [x] **Paso 7.4:** Actualizar pantalla de Carrito en mobile para permitir aplicar puntos disponibles y ver el descuento reflejado.
- [x] **Paso 7.5:** Mostrar saldo de puntos y nivel del cliente en `profile.tsx`.
- [x] **Paso 7.6:** En `manager.tsx`, validar rango permitido de precios y registrar cambio en `price_change_logs`.

---

### Tarea 8: Verificación Global de la Suite y Flujos E2E
**Files:**
- Run full test suite: `npm test` en `backend`
- Run typecheck: `npx tsc --noEmit` en `backend` y `mobile`
- Probar flujos en vivo con los daemons activos.

- [x] **Paso 8.1:** Ejecutar todas las suites de prueba de backend y verificar 100% éxito.
- [x] **Paso 8.2:** Ejecutar typecheck de TypeScript en frontend y backend sin advertencias ni errores.
- [x] **Paso 8.3:** Documentar las nuevas capacidades en `docs/MANUAL_USUARIO.md`.
