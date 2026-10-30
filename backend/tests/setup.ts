process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite3';
process.env.JWT_ACCESS_SECRET = 'test_jwt_access_secret_super_secure_12345';
process.env.GOOGLE_CLIENT_IDS = 'mock-google-client-id';
process.env.FACEBOOK_APP_ID = 'mock-fb-app-id';
process.env.FACEBOOK_APP_SECRET = 'mock-fb-app-secret';
process.env.GITHUB_CLIENT_ID = 'mock-gh-client-id';
process.env.GITHUB_CLIENT_SECRET = 'mock-gh-client-secret';

import { db } from '../src/db/connection';

beforeAll(async () => {
  // Ejecutar migraciones y seeds en la base de datos de test (SQLite en memoria)
  await db.migrate.latest();
  await db.seed.run();
});

afterAll(async () => {
  await db.destroy();
});
