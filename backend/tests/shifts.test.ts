import request from 'supertest';
import app from '../src/app';
import { db } from '../src/db/connection';

describe('Control de Turnos y Arqueo de Caja (/shifts)', () => {
  let cashierPalermoToken: string;
  let customerToken: string;
  let palermoId: number;

  beforeAll(async () => {
    const resCashier = await request(app).post('/auth/login').send({
      email: 'cajero.palermo@latesoft.com.ar',
      password: 'Password123!',
    });
    cashierPalermoToken = resCashier.body.accessToken;

    const resCustomer = await request(app).post('/auth/login').send({
      email: 'cliente@gmail.com',
      password: 'Password123!',
    });
    customerToken = resCustomer.body.accessToken;

    const palermo = await db('branches').where({ slug: 'palermo-soho' }).first();
    palermoId = palermo.id;
  });

  it('rechaza acceso a clientes (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/shifts/current')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });

  it('obtiene el turno abierto actual de la sucursal (inicializado en seed)', async () => {
    const res = await request(app)
      .post('/shifts/current')
      .set('Authorization', `Bearer ${cashierPalermoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.hasOpenShift).toBe(true);
    expect(res.body.data.shift.initialCash).toBe(15000);
    expect(res.body.data.summary.expectedCash).toBeGreaterThanOrEqual(15000);
  });

  it('rechaza abrir otro turno si ya existe uno abierto en la misma sucursal', async () => {
    const res = await request(app)
      .post('/shifts/open')
      .set('Authorization', `Bearer ${cashierPalermoToken}`)
      .send({
        branchId: palermoId,
        initialCash: 10000,
        notes: 'Intento duplicado',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/Ya existe un turno de caja abierto/);
  });

  it('cierra el turno y realiza arqueo de caja con cálculo de diferencia', async () => {
    const currentRes = await request(app)
      .post('/shifts/current')
      .set('Authorization', `Bearer ${cashierPalermoToken}`);

    const shiftId = currentRes.body.data.shift.id;
    const expectedCash = currentRes.body.data.summary.expectedCash;

    // Contamos exactamente $500 de más en la caja
    const countedCash = expectedCash + 500;

    const closeRes = await request(app)
      .post(`/shifts/${shiftId}/close`)
      .set('Authorization', `Bearer ${cashierPalermoToken}`)
      .send({
        finalCashCounted: countedCash,
        notes: 'Arqueo de cierre turno mañana - Sobrante de $500',
      });

    expect(closeRes.status).toBe(200);
    expect(closeRes.body.result.status).toBe('CLOSED');
    expect(closeRes.body.result.cashDifference).toBe(500);

    // Verificar en auditoría
    const audit = await db('audit_logs')
      .where({ action: 'SHIFT_CLOSE', entity_id: shiftId })
      .first();
    expect(audit).toBeDefined();
    expect(audit.details).toContain('finalCashCounted');
  });

  it('permite abrir un nuevo turno una vez cerrado el anterior', async () => {
    const openRes = await request(app)
      .post('/shifts/open')
      .set('Authorization', `Bearer ${cashierPalermoToken}`)
      .send({
        branchId: palermoId,
        initialCash: 20000,
        notes: 'Turno tarde iniciado',
      });

    expect(openRes.status).toBe(201);
    expect(openRes.body.shift.status).toBe('OPEN');
    expect(Number(openRes.body.shift.initial_cash)).toBe(20000);
  });
});
