import request from 'supertest';
import app from '../src/app';

describe('Staff Polivalente y Log de Auditoría (/audit)', () => {
  let cashierPalermoToken: string;
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    const resCashier = await request(app).post('/auth/login').send({
      email: 'cajero.palermo@latesoft.com.ar',
      password: 'Password123!',
    });
    cashierPalermoToken = resCashier.body.accessToken;

    const resAdmin = await request(app).post('/auth/login').send({
      email: 'admin@latesoft.com.ar',
      password: 'Password123!',
    });
    adminToken = resAdmin.body.accessToken;

    const resCustomer = await request(app).post('/auth/login').send({
      email: 'cliente@gmail.com',
      password: 'Password123!',
    });
    customerToken = resCustomer.body.accessToken;
  });

  it('permite a un Cajero polivalente consultar el KDS por tener rol asignado BARISTA en su sucursal', async () => {
    const res = await request(app)
      .post('/orders/kds')
      .set('Authorization', `Bearer ${cashierPalermoToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('permite al Administrador consultar el registro global de auditoría con detalles', async () => {
    const res = await request(app)
      .post('/audit')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.meta).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('rechaza acceso al log de auditoría a usuarios sin rol ADMIN (403 Forbidden)', async () => {
    const resCashier = await request(app)
      .post('/audit')
      .set('Authorization', `Bearer ${cashierPalermoToken}`);
    expect(resCashier.status).toBe(403);

    const resCustomer = await request(app)
      .post('/audit')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(resCustomer.status).toBe(403);
  });
});
