import request from 'supertest';
import app from '../src/app';
import { db } from '../src/db/connection';

describe('Pedidos, Impuestos Argentinos y Aislamiento por Sucursal (RBAC / IDOR)', () => {
  let customerToken: string;
  let cashierPalermoToken: string;
  let managerPalermoToken: string;
  let managerBelgranoToken: string;
  let baristaPalermoToken: string;
  let adminToken: string;

  let palermoId: number;
  let belgranoId: number;
  let espressoPalermoBpId: number;

  beforeAll(async () => {
    // 1. Obtener tokens para cada rol
    const loginUser = async (email: string) => {
      const res = await request(app).post('/auth/login').send({
        email,
        password: 'Password123!',
      });
      return res.body.accessToken;
    };

    customerToken = await loginUser('cliente@gmail.com');
    cashierPalermoToken = await loginUser('cajero.palermo@latesoft.com.ar');
    managerPalermoToken = await loginUser('manager.palermo@latesoft.com.ar');
    managerBelgranoToken = await loginUser('manager.belgrano@latesoft.com.ar');
    baristaPalermoToken = await loginUser('barista.palermo@latesoft.com.ar');
    adminToken = await loginUser('admin@latesoft.com.ar');

    const palermo = await db('branches').where({ slug: 'palermo-soho' }).first();
    const belgrano = await db('branches').where({ slug: 'belgrano-r' }).first();
    palermoId = palermo.id;
    belgranoId = belgrano.id;

    // Buscar Espresso Doble en Palermo
    const bp = await db('branch_products')
      .where({ branch_id: palermoId })
      .first();
    espressoPalermoBpId = bp.id;
  });

  describe('Cálculo de Precios e IVA Argentino (Fórmula Oficial)', () => {
    it('el servidor ignora precios manipulados enviados desde el cliente y calcula el IVA exacto', async () => {
      // Precio en base de datos es 2200.00 (con IVA incluido del 21%)
      // El cliente intenta forzar unitPrice = 1.00
      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          branchId: palermoId,
          orderType: 'TAKE_AWAY',
          items: [
            {
              branchProductId: espressoPalermoBpId,
              quantity: 2,
              unitPrice: 1.00, // Intento de manipulación de precio
            },
          ],
        });

      expect(res.status).toBe(201);
      const order = res.body.order;

      // El total debe ser 2200 * 2 = 4400.00
      expect(order.total_amount).toBe(4400.00);

      // Desglose de IVA al 21%:
      // neto = round(4400 / 1.21, 2) = 3636.36
      // iva = 4400 - 3636.36 = 763.64
      expect(order.subtotal).toBe(3636.36);
      expect(order.tax_amount).toBe(763.64);
      expect(order.status).toBe('PENDING');
      expect(order.payment_status).toBe('UNPAID');
      expect(order.source).toBe('APP');
      expect(order.order_number).toBeGreaterThanOrEqual(1);
    });

    it('ejemplo de consigna: producto de $121 al 21% da IVA $21 y neto $100', async () => {
      // Insertamos temporalmente un producto de $121 en la sucursal para verificar la fórmula
      const category = await db('categories').first();
      const [pId] = await db('products').insert({
        category_id: category.id,
        name: 'Producto Prueba $121',
        description: 'Verificacion matematica de IVA',
        image_url: 'http://test.com/img.jpg',
        base_price: 121.00,
        is_active: true,
      });

      const [bpId] = await db('branch_products').insert({
        branch_id: palermoId,
        product_id: pId,
        price: 121.00,
        is_available: true,
      });

      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          branchId: palermoId,
          orderType: 'DINE_IN',
          items: [{ branchProductId: bpId, quantity: 1 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.order.total_amount).toBe(121.00);
      expect(res.body.order.subtotal).toBe(100.00);
      expect(res.body.order.tax_amount).toBe(21.00);
    });
  });

  describe('Control de Acceso por Rol (RBAC)', () => {
    it('un CUSTOMER no tiene permisos para crear usuarios de staff (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          fullName: 'Staff Ilegítimo',
          email: 'staff.fake@latesoft.com',
          password: 'Password123!',
          role: 'CASHIER',
          branchId: palermoId,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('un MANAGER solo puede crear cajeros o baristas para su propia sucursal', async () => {
      // Intento de crear un ADMIN por parte de un MANAGER
      const resAdmin = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${managerPalermoToken}`)
        .send({
          fullName: 'Admin Fraudulento',
          email: 'admin.fraud@latesoft.com',
          password: 'Password123!',
          role: 'ADMIN',
        });

      expect(resAdmin.status).toBe(403);

      // Creación exitosa de un cajero para Palermo
      const resCashier = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${managerPalermoToken}`)
        .send({
          fullName: 'Nuevo Cajero Palermo',
          email: 'cajero.nuevo.palermo@latesoft.com.ar',
          password: 'Password123!',
          role: 'CASHIER',
          branchId: palermoId,
        });

      expect(resCashier.status).toBe(201);
      expect(resCashier.body.user.role).toBe('CASHIER');
      expect(resCashier.body.user.branch_id).toBe(palermoId);
    });
  });

  describe('Aislamiento Multi-Sucursal (Pruebas Negativas de IDOR)', () => {
    let orderBelgranoId: number;

    beforeAll(async () => {
      // Crear un producto y orden en Belgrano
      const bpBelgrano = await db('branch_products').where({ branch_id: belgranoId }).first();

      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          branchId: belgranoId,
          orderType: 'TAKE_AWAY',
          items: [{ branchProductId: bpBelgrano.id, quantity: 1 }],
        });

      orderBelgranoId = res.body.order.id;
    });

    it('MANAGER de Palermo NO PUEDE ver un pedido de Belgrano (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/orders/${orderBelgranoId}`)
        .set('Authorization', `Bearer ${managerPalermoToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('CAJERO de Palermo NO PUEDE cobrar un pedido de Belgrano (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/orders/${orderBelgranoId}/pay`)
        .set('Authorization', `Bearer ${cashierPalermoToken}`)
        .send({ paymentMethod: 'CASH' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('MANAGER de Palermo NO PUEDE cancelar un pedido de Belgrano (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/orders/${orderBelgranoId}/status`)
        .set('Authorization', `Bearer ${managerPalermoToken}`)
        .send({ status: 'CANCELLED', cancelReason: 'Ataque cruzado' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Máquina de Estados de Pedidos y Transiciones Inválidas', () => {
    let orderId: number;

    beforeAll(async () => {
      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          branchId: palermoId,
          items: [{ branchProductId: espressoPalermoBpId, quantity: 1 }],
        });
      orderId = res.body.order.id;
    });

    it('rechaza pasar directamente a DELIVERED sin haber pasado por PREPARING y READY (422)', async () => {
      const res = await request(app)
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${baristaPalermoToken}`)
        .send({ status: 'DELIVERED' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('rechaza pasar a PREPARING si el pedido aún no fue cobrado (422)', async () => {
      const res = await request(app)
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${baristaPalermoToken}`)
        .send({ status: 'PREPARING' });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain('pagado');
    });

    it('permite el flujo completo una vez cobrado: PENDING -> PREPARING -> READY -> DELIVERED', async () => {
      // 1. Cobrar (Cajero)
      const payRes = await request(app)
        .post(`/orders/${orderId}/pay`)
        .set('Authorization', `Bearer ${cashierPalermoToken}`)
        .send({ paymentMethod: 'CARD' });

      expect(payRes.status).toBe(200);
      expect(payRes.body.order.payment_status).toBe('PAID');

      // 2. Barista pasa a PREPARING
      const prepRes = await request(app)
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${baristaPalermoToken}`)
        .send({ status: 'PREPARING' });

      expect(prepRes.status).toBe(200);
      expect(prepRes.body.order.status).toBe('PREPARING');

      // 3. Barista pasa a READY
      const readyRes = await request(app)
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${baristaPalermoToken}`)
        .send({ status: 'READY' });

      expect(readyRes.status).toBe(200);
      expect(readyRes.body.order.status).toBe('READY');

      // 4. Cajero entrega el pedido (DELIVERED)
      const delivRes = await request(app)
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${cashierPalermoToken}`)
        .send({ status: 'DELIVERED' });

      expect(delivRes.status).toBe(200);
      expect(delivRes.body.order.status).toBe('DELIVERED');

      // 5. Un pedido DELIVERED no puede volver a cambiar de estado
      const invalidRes = await request(app)
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${managerPalermoToken}`)
        .send({ status: 'CANCELLED' });

      expect(invalidRes.status).toBe(422);
    });
  });
});
