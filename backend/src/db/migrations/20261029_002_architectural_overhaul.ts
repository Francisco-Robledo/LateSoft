import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Ampliación de users con PIN para staff/managers
  await knex.schema.alterTable('users', (table) => {
    table.string('pin_hash', 255).nullable();
  });

  // 2. Control de Turnos y Arqueo de Caja (cash_shifts)
  await knex.schema.createTable('cash_shifts', (table) => {
    table.increments('id').primary();
    table.integer('branch_id').unsigned().notNullable().references('id').inTable('branches').onDelete('CASCADE');
    table.integer('opened_by_id').unsigned().notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.integer('closed_by_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('opened_at').defaultTo(knex.fn.now());
    table.timestamp('closed_at').nullable();
    table.decimal('initial_cash', 12, 2).notNullable().defaultTo(0.00);
    table.decimal('final_cash_expected', 12, 2).nullable();
    table.decimal('final_cash_counted', 12, 2).nullable();
    table.decimal('cash_difference', 12, 2).nullable();
    table.text('notes').nullable();
    table.enum('status', ['OPEN', 'CLOSED']).notNullable().defaultTo('OPEN');
  });

  // 3. Asignación Flexible y Polivalente de Staff por Sucursal
  await knex.schema.createTable('staff_branch_assignments', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('branch_id').unsigned().notNullable().references('id').inTable('branches').onDelete('CASCADE');
    table.string('roles', 255).notNullable(); // ej. '["CASHIER","BARISTA"]'
    table.boolean('is_primary').defaultTo(true);
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['user_id', 'branch_id']);
  });

  // 4. Log de Auditoría para Superpermisos y Acciones Sensibles
  await knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('branch_id').unsigned().nullable().references('id').inTable('branches').onDelete('SET NULL');
    table.string('action', 80).notNullable();
    table.string('entity_type', 60).notNullable();
    table.integer('entity_id').nullable();
    table.text('details').nullable(); // JSON stringificado
    table.string('ip_address', 45).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 5. Fidelización de Clientes (Puntos)
  await knex.schema.createTable('customer_loyalty', (table) => {
    table.increments('id').primary();
    table.integer('customer_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE').unique();
    table.integer('points_balance').notNullable().defaultTo(0);
    table.integer('lifetime_points').notNullable().defaultTo(0);
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // 6. Auditoría y Trazabilidad de Precios Locales
  await knex.schema.createTable('price_change_logs', (table) => {
    table.increments('id').primary();
    table.integer('branch_id').unsigned().notNullable().references('id').inTable('branches').onDelete('CASCADE');
    table.integer('product_id').unsigned().notNullable().references('id').inTable('products').onDelete('CASCADE');
    table.integer('changed_by_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.decimal('old_price', 12, 2).notNullable();
    table.decimal('new_price', 12, 2).notNullable();
    table.string('reason', 255).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 7. Extensión de la tabla orders con campos de anulación, turno y puntos
  await knex.schema.alterTable('orders', (table) => {
    table.integer('cancelled_by_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('cancel_reason', 255).nullable();
    table.integer('points_redeemed').defaultTo(0);
    table.decimal('points_discount', 12, 2).defaultTo(0.00);
    table.integer('points_earned').defaultTo(0);
    table.integer('shift_id').unsigned().nullable().references('id').inTable('cash_shifts').onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('orders', (table) => {
    table.dropColumn('shift_id');
    table.dropColumn('points_earned');
    table.dropColumn('points_discount');
    table.dropColumn('points_redeemed');
    table.dropColumn('cancel_reason');
    table.dropColumn('cancelled_by_id');
  });
  await knex.schema.dropTableIfExists('price_change_logs');
  await knex.schema.dropTableIfExists('customer_loyalty');
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('staff_branch_assignments');
  await knex.schema.dropTableIfExists('cash_shifts');
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('pin_hash');
  });
}
