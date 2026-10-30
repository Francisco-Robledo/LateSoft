import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const isMySql = knex.client.config.client === 'mysql2';

  // 1. branches
  await knex.schema.createTable('branches', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.string('slug', 60).notNullable().unique();
    table.string('address', 255).notNullable();
    table.decimal('latitude', 10, 8).notNullable();
    table.decimal('longitude', 11, 8).notNullable();
    table.string('phone', 30).notNullable();
    table.json('opening_hours').notNullable();
    table.boolean('is_open').defaultTo(true);
    table.boolean('is_active').defaultTo(true);
    table.decimal('tax_rate', 5, 2).defaultTo(21.00);
  });

  // 2. users
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('full_name', 120).notNullable();
    table.string('email', 150).nullable().unique();
    table.string('password_hash', 255).nullable();
    table.enum('role', ['ADMIN', 'MANAGER', 'CASHIER', 'BARISTA', 'CUSTOMER']).notNullable();
    table.integer('branch_id').unsigned().nullable().references('id').inTable('branches').onDelete('SET NULL');
    table.string('phone', 30).nullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 3. social_accounts
  await knex.schema.createTable('social_accounts', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('provider', ['GOOGLE', 'FACEBOOK', 'GITHUB', 'DISCORD']).notNullable();
    table.string('provider_user_id', 150).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['provider', 'provider_user_id']);
  });

  // 4. refresh_tokens
  await knex.schema.createTable('refresh_tokens', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('family_id', 64).notNullable().index();
    table.string('token_hash', 64).notNullable().unique();
    table.timestamp('expires_at').notNullable();
    table.timestamp('used_at').nullable();
    table.timestamp('revoked_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 5. categories
  await knex.schema.createTable('categories', (table) => {
    table.increments('id').primary();
    table.string('name', 80).notNullable();
    table.string('icon', 50).notNullable().defaultTo('coffee');
    table.integer('sort_order').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
  });

  // 6. products
  await knex.schema.createTable('products', (table) => {
    table.increments('id').primary();
    table.integer('category_id').unsigned().notNullable().references('id').inTable('categories').onDelete('RESTRICT');
    table.string('name', 120).notNullable();
    table.text('description').notNullable();
    table.string('image_url', 500).notNullable();
    table.decimal('base_price', 12, 2).notNullable();
    table.integer('exclusive_branch_id').unsigned().nullable().references('id').inTable('branches').onDelete('SET NULL');
    table.boolean('is_active').defaultTo(true);
  });

  // 7. branch_products
  await knex.schema.createTable('branch_products', (table) => {
    table.increments('id').primary();
    table.integer('branch_id').unsigned().notNullable().references('id').inTable('branches').onDelete('CASCADE');
    table.integer('product_id').unsigned().notNullable().references('id').inTable('products').onDelete('CASCADE');
    table.decimal('price', 12, 2).notNullable();
    table.boolean('is_available').defaultTo(true);
    table.string('paused_reason', 200).nullable();
    table.unique(['branch_id', 'product_id']);
  });

  // 8. orders
  await knex.schema.createTable('orders', (table) => {
    table.increments('id').primary();
    table.integer('branch_id').unsigned().notNullable().references('id').inTable('branches').onDelete('RESTRICT');
    table.integer('customer_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('order_number').notNullable();
    table.date('business_date').notNullable();
    table.enum('status', ['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED']).notNullable().defaultTo('PENDING');
    table.enum('payment_status', ['UNPAID', 'PAID', 'PENDING_VERIFICATION']).notNullable().defaultTo('UNPAID');
    table.enum('payment_method', ['CASH', 'CARD', 'QR', 'TRANSFER']).nullable();
    table.enum('order_type', ['COUNTER', 'DINE_IN', 'TAKE_AWAY']).notNullable().defaultTo('TAKE_AWAY');
    table.enum('source', ['COUNTER', 'APP']).notNullable();
    table.decimal('subtotal', 12, 2).notNullable();
    table.decimal('tax_amount', 12, 2).notNullable();
    table.decimal('total_amount', 12, 2).notNullable();
    table.text('notes').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('paid_at').nullable();
    table.timestamp('ready_at').nullable();
    table.timestamp('delivered_at').nullable();

    table.unique(['branch_id', 'business_date', 'order_number']);
    table.unique(['id', 'branch_id']); // Indispensable para foranea compuesta de order_items
  });

  // 9. order_items
  await knex.schema.createTable('order_items', (table) => {
    table.increments('id').primary();
    table.integer('order_id').unsigned().notNullable();
    table.integer('branch_id').unsigned().notNullable();
    table.integer('branch_product_id').unsigned().notNullable().references('id').inTable('branch_products').onDelete('RESTRICT');
    table.string('product_name', 120).notNullable();
    table.integer('quantity').notNullable();
    table.decimal('unit_price', 12, 2).notNullable();
    table.string('notes', 255).nullable();

    if (isMySql) {
      table.foreign(['order_id', 'branch_id']).references(['id', 'branch_id']).inTable('orders').onDelete('CASCADE');
    } else {
      table.foreign('order_id').references('id').inTable('orders').onDelete('CASCADE');
    }
  });

  // 10. order_counters
  await knex.schema.createTable('order_counters', (table) => {
    table.integer('branch_id').unsigned().notNullable().references('id').inTable('branches').onDelete('CASCADE');
    table.date('business_date').notNullable();
    table.integer('last_number').notNullable().defaultTo(0);
    table.primary(['branch_id', 'business_date']);
  });

  // 11. favorite_branches
  await knex.schema.createTable('favorite_branches', (table) => {
    table.integer('customer_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('branch_id').unsigned().notNullable().references('id').inTable('branches').onDelete('CASCADE');
    table.primary(['customer_id', 'branch_id']);
  });

  // MySQL specific checks and triggers
  if (isMySql) {
    try {
      await knex.raw(`
        ALTER TABLE users
        ADD CONSTRAINT chk_user_role_branch
        CHECK (
          (role IN ('MANAGER', 'CASHIER', 'BARISTA') AND branch_id IS NOT NULL) OR
          (role IN ('ADMIN', 'CUSTOMER') AND branch_id IS NULL)
        );
      `);
    } catch {
      // Ignorar si el motor ya aplicó la restricción o no soporta checks complejos
    }

    try {
      await knex.raw(`
        CREATE TRIGGER trg_check_branch_product_exclusive
        BEFORE INSERT ON branch_products
        FOR EACH ROW
        BEGIN
          DECLARE v_exclusive_branch INT;
          SELECT exclusive_branch_id INTO v_exclusive_branch FROM products WHERE id = NEW.product_id;
          IF v_exclusive_branch IS NOT NULL AND v_exclusive_branch <> NEW.branch_id THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El producto es exclusivo de otra sucursal';
          END IF;
        END;
      `);
    } catch (e: any) {
      console.warn('[Migration] Note: Triggers not supported by this MySQL dialect/TiDB:', e?.message || e);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const isMySql = knex.client.config.client === 'mysql2';
  if (isMySql) {
    try {
      await knex.raw('DROP TRIGGER IF EXISTS trg_check_branch_product_exclusive;');
    } catch {}
  }
  await knex.schema.dropTableIfExists('favorite_branches');
  await knex.schema.dropTableIfExists('order_counters');
  await knex.schema.dropTableIfExists('order_items');
  await knex.schema.dropTableIfExists('orders');
  await knex.schema.dropTableIfExists('branch_products');
  await knex.schema.dropTableIfExists('products');
  await knex.schema.dropTableIfExists('categories');
  await knex.schema.dropTableIfExists('refresh_tokens');
  await knex.schema.dropTableIfExists('social_accounts');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('branches');
}
