import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Comprobantes de transferencia Mercado Pago y verificación por cajero/encargado
  await knex.schema.alterTable('orders', (table) => {
    table.text('transfer_receipt_url').nullable();
    table.string('transfer_reference', 100).nullable();
    table.integer('transfer_verified_by_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('transfer_verified_at').nullable();
    table.text('transfer_rejected_reason').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('orders', (table) => {
    table.dropColumn('transfer_receipt_url');
    table.dropColumn('transfer_reference');
    table.dropColumn('transfer_verified_by_id');
    table.dropColumn('transfer_verified_at');
    table.dropColumn('transfer_rejected_reason');
  });
}
