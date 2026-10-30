import bcrypt from 'bcryptjs';
import { db } from './connection';

async function bootstrapAdmin(): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Definí BOOTSTRAP_ADMIN_EMAIL con una dirección válida.');
  }
  if (!password || password.length < 16) {
    throw new Error('Definí BOOTSTRAP_ADMIN_PASSWORD con al menos 16 caracteres.');
  }

  await db.transaction(async (trx) => {
    const existingAdmin = await trx('users').where({ role: 'ADMIN' }).first();
    if (existingAdmin) throw new Error('Ya existe un administrador; no se creó otro.');

    const existingEmail = await trx('users').where({ email }).first();
    if (existingEmail) throw new Error('Ese correo ya pertenece a otra cuenta.');

    await trx('users').insert({
      full_name: 'Administrador',
      email,
      password_hash: await bcrypt.hash(password, 12),
      role: 'ADMIN',
      branch_id: null,
      is_active: true,
      created_at: trx.fn.now(),
    });
  });

  console.log(`Administrador inicial creado: ${email}`);
}

bootstrapAdmin()
  .catch((error) => {
    console.error('[Bootstrap admin]', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });
