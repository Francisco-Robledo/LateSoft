import request from 'supertest';
import app from '../src/app';
import { db } from '../src/db/connection';

describe('Manager Override con PIN para Cancelación de Pedidos en POS', () => {
  let cashierPalermoToken: string;
  let baristaPalermoToken: string;
  let palermoId: number;
  let testOrderId: number;

  beforeAll(async () => {
    // Login como cajero de Palermo
    const resCashier = await request(app).post('/auth/login').send({
      email: 'cajero.palermo@latesoft.com.ar',
      password: 'Password123!',
    });
    cashierPalermoToken = resCashier.body.accessToken;

    const resBarista = await request(app).post('/auth/login').send({
      email: 'barista.palermo@latesoft.com.ar',
      password: 'Password123!',
    });
    baristaPalermoToken = resBarista.body.accessToken;

    const palermo = await db('branches').where({ slug: 'palermo-soho' }).first();
    palermoId = palermo.id;

    const bp = await db('branch_products').where({ branch_id: palermoId }).first();

    // Crear un pedido de prueba en Palermo como cajero
    const orderRes = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${cashierPalermoToken}`)
      .send({
        branchId: palermoId,
        orderType: 'TAKE_AWAY',
        items: [{ branchProductId: bp.id, quantity: 1 }],
      });

    testOrderId = orderRes.body.order.id;
  });

  it('rechaza cancelación directa por PATCH /status por no ser MANAGER ni ADMIN', async () => {
    const res = await request(app)
      .patch(`/orders/${testOrderId}/status`)
      .set('Authorization', `Bearer ${cashierPalermoToken}`)
      .send({
        status: 'CANCELLED',
        cancelReason: 'Error de tipeo',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/Solo el encargado/);
  });

  it('rechaza override con PIN incorrecto', async () => {
    const res = await request(app)
      .post(`/orders/${testOrderId}/override-cancel`)
      .set('Authorization', `Bearer ${cashierPalermoToken}`)
      .send({
        managerPin: '9999',
        reason: 'Error de tipeo en mostrador',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/PIN de encargado inválido/);
  });

  it('cancela exitosamente el pedido cuando el cajero ingresa el PIN válido del encargado (1234)', async () => {
    const res = await request(app)
      .post(`/orders/${testOrderId}/override-cancel`)
      .set('Authorization', `Bearer ${cashierPalermoToken}`)
      .send({
        managerPin: '1234',
        reason: 'Cliente solicitó anular orden antes de pagar',
      });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('CANCELLED');
    expect(res.body.authorizedBy).toMatch(/Santiago Ramos|Martina Benítez/);

    // Verificar registro en audit_logs
    const audit = await db('audit_logs')
      .where({
        action: 'ORDER_OVERRIDE_CANCEL',
        entity_id: testOrderId,
      })
      .first();

    expect(audit).toBeDefined();
    expect(audit.branch_id).toBe(palermoId);
    expect(audit.details).toContain('Cliente solicitó anular');
  });

  it('impide volver a cancelar un pedido que ya está en estado CANCELLED', async () => {
    const res = await request(app)
      .post(`/orders/${testOrderId}/override-cancel`)
      .set('Authorization', `Bearer ${cashierPalermoToken}`)
      .send({
        managerPin: '1234',
        reason: 'Intento duplicado',
      });

    expect(res.status).toBe(422);
  });
});
