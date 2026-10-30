import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  DB_CLIENT: z.enum(['mysql2', 'sqlite3']).default('mysql2'),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('latesoft_db'),
  DB_FILENAME: z.string().default(':memory:'),
  DB_SSL: z.coerce.boolean().default(false),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET debe tener al menos 16 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().default(7),

  GOOGLE_CLIENT_IDS: z.string().default('902407434442-2s8218515agq037sk41gv840knr8c40g.apps.googleusercontent.com'),
  FACEBOOK_APP_ID: z.string().default('mock-fb-app-id'),
  FACEBOOK_APP_SECRET: z.string().default('mock-fb-app-secret'),
  GITHUB_CLIENT_ID: z.string().default('Iv23liztxJqVlxyQ88Yz'),
  GITHUB_CLIENT_SECRET: z.string().default('cf43e4717edb8748d14d09655c415e7fa160ca8c'),
  DISCORD_CLIENT_ID: z.string().default('1565184562135310506'),
  DISCORD_CLIENT_SECRET: z.string().default('U6wlE3gqPZL2F_p2R2dv5oV8xnRlNFGO'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(2000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(20),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Error de configuracion de variables de entorno:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
