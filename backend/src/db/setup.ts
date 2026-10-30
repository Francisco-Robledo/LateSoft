import { db } from './connection';

async function runSetup() {
  console.log('[Setup] Iniciando migraciones de base de datos...');
  await db.migrate.latest();
  console.log('[Setup] Migraciones completadas.');

  console.log('[Setup] Ejecutando seeds iniciales con datos de Argentina...');
  await db.seed.run();
  console.log('[Setup] Base de datos configurada y lista para operar.');

  process.exit(0);
}

runSetup().catch((err) => {
  console.error('[Setup] Error configurando la base de datos:', err);
  process.exit(1);
});
