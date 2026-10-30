import type { Knex } from 'knex';
import path from 'path';
import { env } from '../config/env';

const knexConfig: { [key: string]: Knex.Config } = {
  development: {
    client: env.DB_CLIENT === 'sqlite3' ? 'sqlite3' : 'mysql2',
    connection: env.DB_CLIENT === 'sqlite3'
      ? { filename: path.resolve(__dirname, '../../dev.sqlite3') }
      : {
          host: env.DB_HOST,
          port: env.DB_PORT,
          user: env.DB_USER,
          password: env.DB_PASSWORD,
          database: env.DB_NAME,
          charset: 'utf8mb4',
          timezone: '-03:00',
          ssl: env.DB_SSL || env.DB_PORT === 4000 ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
        },
    useNullAsDefault: true,
    pool: { min: 2, max: 10 },
    migrations: {
      directory: path.resolve(__dirname, './migrations'),
      extension: 'ts',
    },
    seeds: {
      directory: path.resolve(__dirname, './seeds'),
      extension: 'ts',
    },
  },
  test: {
    client: 'sqlite3',
    connection: {
      filename: ':memory:',
    },
    useNullAsDefault: true,
    pool: { min: 1, max: 1 },
    migrations: {
      directory: path.resolve(__dirname, './migrations'),
      extension: 'ts',
    },
    seeds: {
      directory: path.resolve(__dirname, './seeds'),
      extension: 'ts',
    },
  },
  production: {
    client: 'mysql2',
    connection: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      charset: 'utf8mb4',
      timezone: '-03:00',
      ssl: env.DB_SSL || env.DB_PORT === 4000 ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
    },
    pool: { min: 2, max: 20 },
    migrations: {
      directory: path.resolve(__dirname, './migrations'),
      extension: 'js',
    },
    seeds: {
      directory: path.resolve(__dirname, './seeds'),
      extension: 'js',
    },
  },
};

export default knexConfig;
