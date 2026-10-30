import request from 'supertest';
import app from '../src/app';
import { db } from '../src/db/connection';

describe('Fidelización de Clientes (/loyalty) y Gobernanza de Precios Locales', () => {
  let customerToken: string;
  let cashierPalermoToken: string;
  let managerPalermoToken: string;
  let adminToken: string;

  let palermoId: number;
  let flatWhiteBpId: number;
  let flatWhiteProdId: number;

  beforeAll(async () => {
    const resCustomer = await request(app).post('/auth/login').send({
      email: 'cliente@gmail.com',
      password: 'Password123!',
    });
    customerToken = resCustomer.body.accessToken;

    const resCashier = await request(app).post('/auth/login').send({
      email: 'cajero.palermo@latesoft.com.ar',
      password: 'Password123!',
    });
    cashierPalermoToken = resCashier.body.accessToken;

    const resManager = await request(app).post('/auth/login').send({
      email: 'manager.palermo@latesoft.com.ar',
      password: 'Password123!',
    });
    managerPalermoToken = resManager.body.accessToken;

    const resAdmin = await request(app).post('/auth/login').send({
      email: 'admin@latesoft.com.ar',
      password: 'Password123!',
    });
    adminToken = resAdmin.body.accessToken;

    const palermo = await db('branches').where({ slug: 'palermo-soho' }).first();
    palermoId = palermo.id;

    const fwProduct = await db('products').where({ name: 'Flat White' }).first();
    flatWhiteProdId = fwProduct.id;

    const bp = await db('branch_products')
      .where({ branch_id: palermoId, product_id: flatWhiteProdId })
      .first();
    flatWhiteBpId = bp.id;
  });

  describe('Fidelización (Puntos)', () => {
    it('obtiene el saldo de puntos del cliente en POST /loyalty/me', async () => {
      const res = await request(app)
        .post('/loyalty/me')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pointsBalance).toBeGreaterThanOrEqual(350);
    });

    it('permite canjear puntos en una orden y descuenta del total', async () => {
      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          branchId: palermoId,
          orderType: 'TAKE_AWAY',
          pointsToRedeem: 50, // 50 puntos = $500 ARS de descuento
          items: [{ branchProductId: flatWhiteBpId, quantity: 1 }],
        });

      expect(res.status).toBe(201);
      const order = res.body.order;
      expect(order.points_redeemed).toBe(50);
      expect(Number(order.points_discount)).toBe(500);

      // Verificar que el saldo del cliente bajó en 50
      const loyaltyRes = await request(app)
        .post('/loyalty/me')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(loyaltyRes.body.data.pointsBalance).toBe(300);
    });

    it('rechaza canjear más puntos de los que el cliente posee (400)', async () => {
      const res = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          branchId: palermoId,
          orderType: 'TAKE_AWAY',
          pointsToRedeem: 99999,
          items: [{ branchProductId: flatWhiteBpId, quantity: 1 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Saldo insuficiente de puntos/);
    });

    it('acredita puntos automáticamente al pagar un pedido ($100 ARS = 1 punto)', async () => {
      // Crear pedido por cliente
      const orderRes = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          branchId: palermoId,
          orderType: 'TAKE_AWAY',
          items: [{ branchProductId: flatWhiteBpId, quantity: 1 }],
        });

      const orderId = orderRes.body.order.id;
      const totalAmount = Number(orderRes.body.order.total_amount);
      const expectedPoints = Math.floor(totalAmount / 100);

      // Cobrar con cajero
      const payRes = await request(app)
        .post(`/orders/${orderId}/pay`)
        .set('Authorization', `Bearer ${cashierPalermoToken}`)
        .send({ paymentMethod: 'CASH' });

      expect(payRes.status).toBe(200);
      expect(payRes.body.order.points_earned).toBe(expectedPoints);

      // Verificar aumento de saldo
      const loyaltyRes = await request(app)
        .post('/loyalty/me')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(loyaltyRes.body.data.pointsBalance).toBe(300 + expectedPoints);
    });
  });

  describe('Gobernanza de Precios Locales', () => {
    it('rechaza a un MANAGER establecer un precio local que difiera en más del 20% del catálogo maestro', async () => {
      // Precio base del Flat White es 3500. El +20% maximo es 4200.
      // Manager intenta poner 5000 (+42.8%)
      const res = await request(app)
        .patch(`/branches/${palermoId}/menu/${flatWhiteProdId}`)
        .set('Authorization', `Bearer ${managerPalermoToken}`)
        .send({ price: 5000 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/no puede diferir en más del 20%/);
    });

    it('permite a un MANAGER ajustar un precio dentro del margen permitido (+8.5%) y registra log', async () => {
      const res = await request(app)
        .patch(`/branches/${palermoId}/menu/${flatWhiteProdId}`)
        .set('Authorization', `Bearer ${managerPalermoToken}`)
        .send({ price: 3800 });

      expect(res.status).toBe(200);
      expect(Number(res.body.branchProduct.price)).toBe(3800);

      // Verificar registro en price_change_logs
      const priceLog = await db('price_change_logs')
        .where({ branch_id: palermoId, product_id: flatWhiteProdId })
        .orderBy('id', 'desc')
        .first();
      expect(priceLog).toBeDefined();
      expect(Number(priceLog.new_price)).toBe(3800);

      // Verificar en audit_logs
      const auditLog = await db('audit_logs')
        .where({ action: 'PRICE_UPDATE', branch_id: palermoId })
        .orderBy('id', 'desc')
        .first();
      expect(auditLog).toBeDefined();
      expect(auditLog.details).toContain('3800');
    });

    it('permite a un ADMIN cambiar precios fuera de límites si es decisión ejecutiva', async () => {
      const res = await request(app)
        .patch(`/branches/${palermoId}/menu/${flatWhiteProdId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 6000 });

      expect(res.status).toBe(200);
      expect(Number(res.body.branchProduct.price)).toBe(6000);
    });
  });
});
