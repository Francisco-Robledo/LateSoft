import { db } from './connection';

async function runMigrate() {
  console.log('[Migrate] Ejecutando migraciones pendientes...');
  const [batchNo, log] = await db.migrate.latest();
  console.log(`[Migrate] Batch ${batchNo} ejecutado con éxito:`, log);
  process.exit(0);
}

runMigrate().catch((err) => {
  console.error('[Migrate] Error:', err);
  process.exit(1);
});
