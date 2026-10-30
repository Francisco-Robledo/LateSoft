import knex, { Knex } from 'knex';
import knexConfig from './knexfile';
import { env } from '../config/env';

const environment = env.NODE_ENV || 'development';
const config = knexConfig[environment] || knexConfig.development;

export const db: Knex = knex(config);

export async function checkDatabaseConnection(): Promise<void> {
  try {
    await db.raw('SELECT 1');
    console.log(`[DB] Conectado exitosamente con cliente: ${config.client}`);
  } catch (err) {
    console.error('[DB] Error de conexion a la base de datos:', err);
    throw err;
  }
}
