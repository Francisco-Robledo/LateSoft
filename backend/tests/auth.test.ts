import request from 'supertest';
import app from '../src/app';
import { db } from '../src/db/connection';
import { SocialVerifier } from '../src/modules/auth/socialVerifier';
import jwt from 'jsonwebtoken';

describe('Módulo de Autenticación y Seguridad (/auth)', () => {
  describe('POST /auth/register', () => {
    it('debe registrar un cliente nuevo exitosamente', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          fullName: 'Juan Pérez',
          email: 'juan.perez@test.com',
          password: 'Password123!',
          phone: '+54 11 1234-5678',
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('juan.perez@test.com');
      expect(res.body.user.role).toBe('CUSTOMER');
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('invariable de seguridad: si envían role=ADMIN en el cuerpo, igualmente crea un CUSTOMER', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          fullName: 'Hacker Intentando Ser Admin',
          email: 'hacker@test.com',
          password: 'Password123!',
          role: 'ADMIN',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('CUSTOMER'); // El rol ADMIN fue estrictamente ignorado
    });

    it('debe rechazar registro con correo duplicado (409 Conflict)', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          fullName: 'Cliente Duplicado',
          email: 'cliente@gmail.com', // ya existe en seed
          password: 'Password123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('POST /auth/login', () => {
    it('debe iniciar sesión con credenciales correctas', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'cliente@gmail.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('cliente@gmail.com');
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('debe rechazar contraseña incorrecta (401 Unauthorized)', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'cliente@gmail.com',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /auth/refresh (Rotación y Detección de Reutilización)', () => {
    it('debe renovar tokens con rotación válida', async () => {
      // 1. Login para obtener refresh token
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'cliente@gmail.com', password: 'Password123!' });

      const oldRefreshToken = loginRes.body.refreshToken;

      // 2. Renovar
      const refreshRes = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: oldRefreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.accessToken).toBeDefined();
      expect(refreshRes.body.refreshToken).toBeDefined();
      expect(refreshRes.body.refreshToken).not.toBe(oldRefreshToken);

      // 3. SEGURIDAD: Reutilización de token ya usado provoca revocación de toda la familia
      const reuseRes = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: oldRefreshToken });

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error.message).toContain('reutilización');

      // 4. El token nuevo también debe haber quedado revocado por pertenecer a la misma familia
      const revokedRes = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: refreshRes.body.refreshToken });

      expect(revokedRes.status).toBe(401);
    });
  });

  describe('Token Expirado y Logout', () => {
    it('debe rechazar token de acceso expirado', async () => {
      const expiredToken = jwt.sign(
        { sub: 1, role: 'CUSTOMER', branchId: null },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .post('/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('debe revocar la sesión al hacer logout', async () => {
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'cliente@gmail.com', password: 'Password123!' });

      const { refreshToken, accessToken } = loginRes.body;

      const logoutRes = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(logoutRes.status).toBe(200);

      // Intentar refrescar con el token deslogueado debe fallar
      const refreshRes = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(401);
    });
  });

  describe('Login Social y Vinculación Segura (/auth/social)', () => {
    it('vincula automáticamente una cuenta de Google si el usuario es CUSTOMER', async () => {
      // Mock de verificación de Google
      jest.spyOn(SocialVerifier, 'verifyGoogle').mockResolvedValueOnce({
        provider: 'GOOGLE',
        providerUserId: 'google-sub-123456',
        email: 'cliente@gmail.com', // Coincide con CUSTOMER existente
        fullName: 'Agustín Gómez',
        emailVerified: true,
      });

      const res = await request(app)
        .post('/auth/social')
        .send({
          provider: 'GOOGLE',
          idToken: 'mock-valid-google-id-token',
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('cliente@gmail.com');
      expect(res.body.user.role).toBe('CUSTOMER');
    });

    it('REGLA DE SEGURIDAD CRÍTICA: NO vincula cuenta social si el email pertenece a Staff o Admin', async () => {
      // Mock de verificación de Google devolviendo el email del Administrador
      jest.spyOn(SocialVerifier, 'verifyGoogle').mockResolvedValueOnce({
        provider: 'GOOGLE',
        providerUserId: 'google-sub-hacker',
        email: 'admin@latesoft.com.ar', // Usuario ADMIN
        fullName: 'Intento de toma de control',
        emailVerified: true,
      });

      const res = await request(app)
        .post('/auth/social')
        .send({
          provider: 'GOOGLE',
          idToken: 'mock-token-admin',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('personal');
    });
  });

  describe('Regla de Arquitectura: Prohibido el uso de GET (Todo POST)', () => {
    it('rechaza cualquier petición HTTP GET con 405 Method Not Allowed', async () => {
      const res = await request(app).get('/products');
      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
      expect(res.body.error.message).toContain('El método GET está estrictamente prohibido');
    });

    it('permite verificar estado del servidor por POST /health', async () => {
      const res = await request(app).post('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
