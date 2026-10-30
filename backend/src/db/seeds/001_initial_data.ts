import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';

export async function seed(knex: Knex): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed de demostración está deshabilitado en producción.');
  }

  // Limpieza en orden inverso de dependencias
  await knex('price_change_logs').del();
  await knex('customer_loyalty').del();
  await knex('audit_logs').del();
  await knex('staff_branch_assignments').del();
  await knex('favorite_branches').del();
  await knex('order_counters').del();
  await knex('order_items').del();
  await knex('orders').del();
  await knex('cash_shifts').del();
  await knex('branch_products').del();
  await knex('products').del();
  await knex('categories').del();
  await knex('refresh_tokens').del();
  await knex('social_accounts').del();
  await knex('users').del();
  await knex('branches').del();

  // 1. Sucursales en CABA, Argentina con coordenadas reales y horarios
  const openingHours = JSON.stringify({
    monday: { open: '07:30', close: '20:30' },
    tuesday: { open: '07:30', close: '20:30' },
    wednesday: { open: '07:30', close: '20:30' },
    thursday: { open: '07:30', close: '20:30' },
    friday: { open: '07:30', close: '22:00' },
    saturday: { open: '08:30', close: '22:00' },
    sunday: { open: '09:00', close: '20:00' },
  });

  const [palermoId, belgranoId, sanTelmoId] = await knex('branches').insert([
    {
      name: 'LateSoft Palermo Soho',
      slug: 'palermo-soho',
      address: 'Honduras 4912, Palermo, CABA',
      latitude: -34.58850000,
      longitude: -58.43050000,
      phone: '+54 11 4832-1100',
      opening_hours: openingHours,
      is_open: true,
      is_active: true,
      tax_rate: 21.00,
    },
    {
      name: 'LateSoft Belgrano R',
      slug: 'belgrano-r',
      address: 'Echeverría 3150, Belgrano, CABA',
      latitude: -34.56150000,
      longitude: -58.45650000,
      phone: '+54 11 4781-5544',
      opening_hours: openingHours,
      is_open: true,
      is_active: true,
      tax_rate: 21.00,
    },
    {
      name: 'LateSoft San Telmo Colonial',
      slug: 'san-telmo',
      address: 'Defensa 840, San Telmo, CABA',
      latitude: -34.62120000,
      longitude: -58.37310000,
      phone: '+54 11 4361-9922',
      opening_hours: openingHours,
      is_open: true,
      is_active: true,
      tax_rate: 21.00,
    },
  ]);

  // Si el cliente no retorna IDs (como en MySQL insert array a veces), recuperamos por slug
  const palermo = await knex('branches').where({ slug: 'palermo-soho' }).first();
  const belgrano = await knex('branches').where({ slug: 'belgrano-r' }).first();
  const sanTelmo = await knex('branches').where({ slug: 'san-telmo' }).first();

  const bPalermoId = palermo.id;
  const bBelgranoId = belgrano.id;
  const bSanTelmoId = sanTelmo.id;

  // 2. Usuarios de prueba (contraseña común: Password123! con bcrypt 12, PIN: 1234)
  const passwordHash = await bcrypt.hash('Password123!', 12);
  const pinHash = await bcrypt.hash('1234', 10);

  await knex('users').insert([
    {
      full_name: 'Santiago Ramos (Administrador General)',
      email: 'admin@latesoft.com.ar',
      password_hash: passwordHash,
      pin_hash: pinHash,
      role: 'ADMIN',
      branch_id: null,
      phone: '+54 9 11 5001-0001',
      is_active: true,
    },
    {
      full_name: 'Martina Benítez (Encargada Palermo)',
      email: 'manager.palermo@latesoft.com.ar',
      password_hash: passwordHash,
      pin_hash: pinHash,
      role: 'MANAGER',
      branch_id: bPalermoId,
      phone: '+54 9 11 5001-0002',
      is_active: true,
    },
    {
      full_name: 'Facundo Rossi (Encargado Belgrano)',
      email: 'manager.belgrano@latesoft.com.ar',
      password_hash: passwordHash,
      pin_hash: pinHash,
      role: 'MANAGER',
      branch_id: bBelgranoId,
      phone: '+54 9 11 5001-0003',
      is_active: true,
    },
    {
      full_name: 'Lucas Pereyra (Cajero Palermo)',
      email: 'cajero.palermo@latesoft.com.ar',
      password_hash: passwordHash,
      pin_hash: pinHash,
      role: 'CASHIER',
      branch_id: bPalermoId,
      phone: '+54 9 11 5001-0004',
      is_active: true,
    },
    {
      full_name: 'Camila Sosa (Barista Palermo)',
      email: 'barista.palermo@latesoft.com.ar',
      password_hash: passwordHash,
      pin_hash: pinHash,
      role: 'BARISTA',
      branch_id: bPalermoId,
      phone: '+54 9 11 5001-0005',
      is_active: true,
    },
    {
      full_name: 'Agustín Gómez (Cliente Frecuente)',
      email: 'cliente@gmail.com',
      password_hash: passwordHash,
      pin_hash: null,
      role: 'CUSTOMER',
      branch_id: null,
      phone: '+54 9 11 5001-0006',
      is_active: true,
    },
  ]);

  // 3. Categorías
  await knex('categories').insert([
    { name: 'Café de Especialidad', icon: 'coffee', sort_order: 1, is_active: true },
    { name: 'Bebidas Frías & Iced Coffee', icon: 'cup-water', sort_order: 2, is_active: true },
    { name: 'Té en Hebras & Infusiones', icon: 'tea', sort_order: 3, is_active: true },
    { name: 'Pastelería & Bakery', icon: 'cake', sort_order: 4, is_active: true },
    { name: 'Tostados & Sándwiches', icon: 'food', sort_order: 5, is_active: true },
    { name: 'Desayunos & Brunch', icon: 'food-croissant', sort_order: 6, is_active: true },
    { name: 'Almacén de Café', icon: 'package-variant-closed', sort_order: 7, is_active: true },
  ]);

  const catEspecialidad = await knex('categories').where({ name: 'Café de Especialidad' }).first();
  const catFrias = await knex('categories').where({ name: 'Bebidas Frías & Iced Coffee' }).first();
  const catBakery = await knex('categories').where({ name: 'Pastelería & Bakery' }).first();
  const catSandwiches = await knex('categories').where({ name: 'Tostados & Sándwiches' }).first();
  const catBrunch = await knex('categories').where({ name: 'Desayunos & Brunch' }).first();
  const catAlmacen = await knex('categories').where({ name: 'Almacén de Café' }).first();

  // 4. Productos de marca (alguno exclusivo de Palermo Soho)
  await knex('products').insert([
    {
      category_id: catEspecialidad.id,
      name: 'Espresso Doble',
      description: 'Extracción balanceada con blend propio de granos arábicos tostados en origen.',
      image_url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=500&q=80',
      base_price: 2200.00,
      exclusive_branch_id: null,
      is_active: true,
    },
    {
      category_id: catEspecialidad.id,
      name: 'Flat White',
      description: 'Doble shot de espresso con leche texturizada sedosa y una fina capa de microespuma.',
      image_url: 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?w=500&q=80',
      base_price: 3500.00,
      exclusive_branch_id: null,
      is_active: true,
    },
    {
      category_id: catEspecialidad.id,
      name: 'Cappuccino Italiano',
      description: 'Espresso intenso, leche vaporizada y abundante espuma cremosa con cacao amargo espolvoreado.',
      image_url: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=500&q=80',
      base_price: 3600.00,
      exclusive_branch_id: null,
      is_active: true,
    },
    {
      category_id: catEspecialidad.id,
      name: 'Latte Vainilla Bourbon',
      description: 'Café suave con infusión de sirope casero de vainilla de Madagascar.',
      image_url: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=500&q=80',
      base_price: 3800.00,
      exclusive_branch_id: null,
      is_active: true,
    },
    {
      category_id: catFrias.id,
      name: 'Cold Brew Clásico',
      description: 'Maceración en frío durante 18 horas para una taza dulce, refrescante y con baja acidez.',
      image_url: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500&q=80',
      base_price: 3400.00,
      exclusive_branch_id: null,
      is_active: true,
    },
    {
      category_id: catFrias.id,
      name: 'Iced Caramel Macchiato',
      description: 'Espresso sobre hielo, leche fresca y remate de salsa de caramelo salado.',
      image_url: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=500&q=80',
      base_price: 4100.00,
      exclusive_branch_id: null,
      is_active: true,
    },
    {
      category_id: catBakery.id,
      name: 'Croissant Francés de Manteca',
      description: 'Hojaldre 100% manteca fermentado lentamente durante 24 horas.',
      image_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&q=80',
      base_price: 2100.00,
      exclusive_branch_id: null,
      is_active: true,
    },
    {
      category_id: catBakery.id,
      name: 'Medialuna Artesanal',
      description: 'Tradicional receta argentina almibarada con notas cítricas de naranja y vainilla.',
      image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=80',
      base_price: 1400.00,
      exclusive_branch_id: null,
      is_active: true,
    },
    {
      category_id: catBakery.id,
      name: 'Tarta Vasca de Queso',
      description: 'Horneada a alta temperatura, centro cremoso y superficie tostada caramelizada.',
      image_url: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=500&q=80',
      base_price: 4200.00,
      exclusive_branch_id: null,
      is_active: true,
    },
    {
      category_id: catBakery.id,
      name: 'Alfajor Palermo Pistacho & Frambuesa',
      description: 'Edición exclusiva de autor: masa sablée de pistachos, ganache blanca y corazón de frambuesa fresca.',
      image_url: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=500&q=80',
      base_price: 3200.00,
      exclusive_branch_id: bPalermoId, // Exclusivo de Palermo Soho
      is_active: true,
    },
    {
      category_id: catSandwiches.id,
      name: 'Tostado Clásico Tybo y Jamón',
      description: 'Pan de masa madre tostado a la plancha con abundante queso Tybo fundido y jamón cocido natural.',
      image_url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&q=80',
      base_price: 4500.00,
      exclusive_branch_id: null,
      is_active: true,
    },
    {
      category_id: catSandwiches.id,
      name: 'Focaccia con Mortadela y Stracciatella',
      description: 'Focaccia al romero rellena de mortadela con pistachos, queso stracciatella y rúcula selvática.',
      image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&q=80',
      base_price: 6200.00,
      exclusive_branch_id: null,
      is_active: true,
    },
    {
      category_id: catBrunch.id,
      name: 'Avocado Toast & Huevo Poché',
      description: 'Rodaja de pan de campo integral, palta fresca pisada, tomates cherry asados y huevo de campo poché.',
      image_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&q=80',
      base_price: 5400.00,
      exclusive_branch_id: null,
      is_active: true,
    },
    {
      category_id: catAlmacen.id,
      name: 'Café de Origen Colombia Huila 250g',
      description: 'Notas de cata a caramelo, durazno y chocolate con leche. Tueste medio para filtro o espresso.',
      image_url: 'https://images.unsplash.com/photo-1611854779393-1b2da9d400fe?w=500&q=80',
      base_price: 13500.00,
      exclusive_branch_id: null,
      is_active: true,
    },
  ]);

  const allProducts = await knex('products').select('*');

  // 5. Configuración de Menú por Sucursal (branch_products)
  // Palermo Soho ofrece todos (incluyendo su exclusivo), con precios de local
  for (const prod of allProducts) {
    let localPrice = Number(prod.base_price);
    if (prod.exclusive_branch_id === bPalermoId || prod.exclusive_branch_id === null) {
      await knex('branch_products').insert({
        branch_id: bPalermoId,
        product_id: prod.id,
        price: localPrice,
        is_available: true,
      });
    }
  }

  // Belgrano R ofrece los generales con una variación de precio local (+5%)
  for (const prod of allProducts) {
    if (prod.exclusive_branch_id === null) {
      const belgranoPrice = Math.round(Number(prod.base_price) * 1.05);
      await knex('branch_products').insert({
        branch_id: bBelgranoId,
        product_id: prod.id,
        price: belgranoPrice,
        is_available: true,
      });
    }
  }

  // San Telmo ofrece los generales al precio base
  for (const prod of allProducts) {
    if (prod.exclusive_branch_id === null) {
      await knex('branch_products').insert({
        branch_id: bSanTelmoId,
        product_id: prod.id,
        price: prod.base_price,
        is_available: true,
      });
    }
  }

  // 6. Sucursal Favorita y Fidelización inicial para el cliente de prueba
  const customer = await knex('users').where({ email: 'cliente@gmail.com' }).first();
  await knex('favorite_branches').insert({
    customer_id: customer.id,
    branch_id: bPalermoId,
  });

  await knex('customer_loyalty').insert({
    customer_id: customer.id,
    points_balance: 350,
    lifetime_points: 350,
  });

  // 7. Asignaciones de Staff polivalente por sucursal
  const managerPalermo = await knex('users').where({ email: 'manager.palermo@latesoft.com.ar' }).first();
  const managerBelgrano = await knex('users').where({ email: 'manager.belgrano@latesoft.com.ar' }).first();
  const cashierPalermo = await knex('users').where({ email: 'cajero.palermo@latesoft.com.ar' }).first();
  const baristaPalermo = await knex('users').where({ email: 'barista.palermo@latesoft.com.ar' }).first();

  await knex('staff_branch_assignments').insert([
    {
      user_id: managerPalermo.id,
      branch_id: bPalermoId,
      roles: JSON.stringify(['MANAGER']),
      is_primary: true,
      is_active: true,
    },
    {
      user_id: managerBelgrano.id,
      branch_id: bBelgranoId,
      roles: JSON.stringify(['MANAGER']),
      is_primary: true,
      is_active: true,
    },
    {
      user_id: cashierPalermo.id,
      branch_id: bPalermoId,
      roles: JSON.stringify(['CASHIER', 'BARISTA']), // Polivalente
      is_primary: true,
      is_active: true,
    },
    {
      user_id: baristaPalermo.id,
      branch_id: bPalermoId,
      roles: JSON.stringify(['BARISTA', 'CASHIER']), // Polivalente
      is_primary: true,
      is_active: true,
    },
  ]);

  // 8. Turno de Caja abierto para Palermo Soho
  await knex('cash_shifts').insert({
    branch_id: bPalermoId,
    opened_by_id: cashierPalermo.id,
    initial_cash: 15000.00,
    status: 'OPEN',
    notes: 'Turno mañana iniciado con fondo de cambio estándar',
  });

  console.log('[Seed] Datos iniciales de LateSoft insertados exitosamente.');
}
