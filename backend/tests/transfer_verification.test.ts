import request from 'supertest';
import app from '../src/app';
import { db } from '../src/db/connection';

describe('Flujo de Pago con Mercado Pago Alias/QR y Verificación de Cajero', () => {
  let customerToken: string;
  let cashierToken: string;
  let baristaToken: string;
  let orderId: number;

  beforeAll(async () => {
    const loginUser = async (email: string) => {
      const res = await request(app).post('/auth/login').send({
        email,
        password: 'Password123!',
      });
      return res.body.accessToken;
    };

    customerToken = await loginUser('cliente@gmail.com');
    cashierToken = await loginUser('cajero.palermo@latesoft.com.ar');
    baristaToken = await loginUser('barista.palermo@latesoft.com.ar');
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('1. Cliente realiza pedido seleccionando TRANSFER (Mercado Pago) y queda PENDING_VERIFICATION', async () => {
    const res = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        branchId: 1,
        orderType: 'TAKE_AWAY',
        paymentMethod: 'TRANSFER',
        transferReference: 'MP-9847291',
        transferReceiptUrl: 'https://storage.latesoft.com.ar/receipts/mp_9847291.jpg',
        items: [{ branchProductId: 1, quantity: 2 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.order.payment_status).toBe('PENDING_VERIFICATION');
    expect(res.body.order.payment_method).toBe('TRANSFER');
    expect(res.body.order.transfer_reference).toBe('MP-9847291');
    expect(res.body.order.transfer_receipt_url).toContain('mp_9847291.jpg');

    orderId = res.body.order.id;
  });

  it('2. El pedido PENDING_VERIFICATION NO aparece en el KDS de la cocina', async () => {
    const res = await request(app)
      .post('/orders/kds')
      .set('Authorization', `Bearer ${baristaToken}`)
      .send({});

    expect(res.status).toBe(200);
    const kdsOrder = res.body.data.find((o: any) => o.id === orderId);
    expect(kdsOrder).toBeUndefined();
  });

  it('3. El cajero visualiza el pedido en el listado de transferencias pendientes', async () => {
    const res = await request(app)
      .post('/orders/pending-transfers')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({});

    expect(res.status).toBe(200);
    const pending = res.body.data.find((o: any) => o.id === orderId);
    expect(pending).toBeDefined();
    expect(pending.transfer_reference).toBe('MP-9847291');
  });

  it('4. El cajero puede rechazar el comprobante con motivo explicativo', async () => {
    const res = await request(app)
      .post(`/orders/${orderId}/verify-transfer`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        approved: false,
        rejectionReason: 'El monto de la transferencia no coincide con el total del pedido',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.payment_status).toBe('UNPAID');
    expect(res.body.data.transfer_rejected_reason).toBe(
      'El monto de la transferencia no coincide con el total del pedido'
    );
  });

  it('5. El cliente vuelve a subir el comprobante corregido', async () => {
    const res = await request(app)
      .post(`/orders/${orderId}/transfer-proof`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        transferReference: 'MP-9847300',
        transferReceiptUrl: 'https://storage.latesoft.com.ar/receipts/mp_9847300_corrected.jpg',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.payment_status).toBe('PENDING_VERIFICATION');
    expect(res.body.data.transfer_reference).toBe('MP-9847300');
    expect(res.body.data.transfer_rejected_reason).toBeNull();
  });

  it('6. El cajero aprueba el comprobante: pasa a PAID, suma puntos y se envía al KDS', async () => {
    const res = await request(app)
      .post(`/orders/${orderId}/verify-transfer`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        approved: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.payment_status).toBe('PAID');
    expect(res.body.data.paid_at).toBeDefined();
    expect(res.body.data.transfer_verified_by_id).toBeDefined();

    // Ahora SÍ aparece en KDS
    const kdsRes = await request(app)
      .post('/orders/kds')
      .set('Authorization', `Bearer ${baristaToken}`)
      .send({});

    expect(kdsRes.status).toBe(200);
    const kdsOrder = kdsRes.body.data.find((o: any) => o.id === orderId);
    expect(kdsOrder).toBeDefined();
  });
});
