import { db } from '../../db/connection';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors';
import { TokenPayload } from '../../utils/tokens';

export class BranchesService {
  public static async listBranches(includeInactive = false) {
    let query = db('branches').select('*');
    if (!includeInactive) {
      query = query.where({ is_active: true });
    }
    const branches = await query.orderBy('id', 'asc');
    return branches.map((b) => ({
      ...b,
      opening_hours: typeof b.opening_hours === 'string' ? JSON.parse(b.opening_hours) : b.opening_hours,
      latitude: Number(b.latitude),
      longitude: Number(b.longitude),
      tax_rate: Number(b.tax_rate),
    }));
  }

  public static async getBranchByIdOrSlug(identifier: string | number) {
    let query = db('branches');
    if (typeof identifier === 'number' || !isNaN(Number(identifier))) {
      query = query.where({ id: Number(identifier) });
    } else {
      query = query.where({ slug: identifier });
    }

    const branch = await query.first();
    if (!branch) {
      throw new NotFoundError('Sucursal no encontrada');
    }

    return {
      ...branch,
      opening_hours: typeof branch.opening_hours === 'string' ? JSON.parse(branch.opening_hours) : branch.opening_hours,
      latitude: Number(branch.latitude),
      longitude: Number(branch.longitude),
      tax_rate: Number(branch.tax_rate),
    };
  }

  public static async createBranch(payload: any) {
    const existingSlug = await db('branches').where({ slug: payload.slug }).first();
    if (existingSlug) {
      throw new ConflictError('Ya existe una sucursal con ese slug');
    }

    const [id] = await db('branches').insert({
      name: payload.name,
      slug: payload.slug,
      address: payload.address,
      latitude: payload.latitude,
      longitude: payload.longitude,
      phone: payload.phone,
      opening_hours: JSON.stringify(payload.openingHours),
      tax_rate: payload.taxRate ?? 21.00,
      is_open: true,
      is_active: true,
    });

    return this.getBranchByIdOrSlug(id);
  }

  public static async updateBranch(id: number, payload: any) {
    const branch = await db('branches').where({ id }).first();
    if (!branch) {
      throw new NotFoundError('Sucursal no encontrada');
    }

    const updateData: any = {};
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.address !== undefined) updateData.address = payload.address;
    if (payload.latitude !== undefined) updateData.latitude = payload.latitude;
    if (payload.longitude !== undefined) updateData.longitude = payload.longitude;
    if (payload.phone !== undefined) updateData.phone = payload.phone;
    if (payload.openingHours !== undefined) updateData.opening_hours = JSON.stringify(payload.openingHours);
    if (payload.isOpen !== undefined) updateData.is_open = payload.isOpen;
    if (payload.isActive !== undefined) updateData.is_active = payload.isActive;
    if (payload.taxRate !== undefined) updateData.tax_rate = payload.taxRate;

    await db('branches').where({ id }).update(updateData);
    return this.getBranchByIdOrSlug(id);
  }

  public static async deactivateBranch(id: number) {
    const branch = await db('branches').where({ id }).first();
    if (!branch) {
      throw new NotFoundError('Sucursal no encontrada');
    }
    await db('branches').where({ id }).update({ is_active: false, is_open: false });
  }

  /**
   * Obtiene la carta/menú completo de una sucursal, organizado por categorías
   */
  public static async getBranchMenu(branchId: number) {
    const branch = await this.getBranchByIdOrSlug(branchId);

    const categories = await db('categories')
      .where({ is_active: true })
      .orderBy('sort_order', 'asc');

    const menuItems = await db('branch_products')
      .join('products', 'branch_products.product_id', 'products.id')
      .where('branch_products.branch_id', branch.id)
      .andWhere('products.is_active', true)
      .select(
        'branch_products.id as branch_product_id',
        'branch_products.branch_id',
        'products.id as product_id',
        'products.category_id',
        'products.name',
        'products.description',
        'products.image_url',
        'branch_products.price',
        'products.base_price',
        'branch_products.is_available',
        'branch_products.paused_reason'
      )
      .orderBy('products.name', 'asc');

    // Agrupar por categoría
    const menu = categories.map((cat) => ({
      ...cat,
      items: menuItems
        .filter((item) => item.category_id === cat.id)
        .map((item) => ({
          ...item,
          price: Number(item.price),
          base_price: Number(item.base_price),
          is_available: Boolean(item.is_available),
        })),
    }));

    return {
      branch,
      menu,
    };
  }

  /**
   * Agrega o configura un producto en la sucursal (MANAGER de la sucursal o ADMIN)
   */
  public static async addProductToBranch(
    currentUser: TokenPayload,
    branchId: number,
    productId: number,
    price: number,
    isAvailable = true
  ) {
    if (currentUser.role === 'MANAGER' && currentUser.branchId !== branchId) {
      throw new ForbiddenError('No tenés permisos para gestionar el menú de otra sucursal');
    }

    const product = await db('products').where({ id: productId }).first();
    if (!product || !product.is_active) {
      throw new NotFoundError('Producto no encontrado o inactivo');
    }

    // Validación de exclusividad
    if (product.exclusive_branch_id !== null && product.exclusive_branch_id !== branchId) {
      throw new ValidationError('Este producto es exclusivo de otra sucursal de la marca');
    }

    const existing = await db('branch_products')
      .where({ branch_id: branchId, product_id: productId })
      .first();

    if (existing) {
      await db('branch_products')
        .where({ id: existing.id })
        .update({ price, is_available: isAvailable, paused_reason: null });
      return db('branch_products').where({ id: existing.id }).first();
    }

    const [id] = await db('branch_products').insert({
      branch_id: branchId,
      product_id: productId,
      price,
      is_available: isAvailable,
    });

    return db('branch_products').where({ id }).first();
  }

  public static async updateBranchProduct(
    currentUser: TokenPayload,
    branchId: number,
    productId: number,
    data: { price?: number; isAvailable?: boolean }
  ) {
    if (currentUser.role === 'MANAGER' && currentUser.branchId !== branchId) {
      throw new ForbiddenError('No tenés permisos para gestionar el menú de otra sucursal');
    }

    const branchProduct = await db('branch_products')
      .where({ branch_id: branchId, product_id: productId })
      .first();

    if (!branchProduct) {
      throw new NotFoundError('El producto no está configurado en esta sucursal');
    }

    const updateData: any = {};
    if (data.price !== undefined) {
      const masterProduct = await db('products').where({ id: productId }).first();
      const basePrice = Number(masterProduct.base_price);
      const newPrice = Number(data.price);

      // Si es MANAGER, no puede desviarse en más del 20% del precio base maestro
      if (currentUser.role === 'MANAGER') {
        const minAllowed = basePrice * 0.8;
        const maxAllowed = basePrice * 1.2;
        if (newPrice < minAllowed || newPrice > maxAllowed) {
          throw new ValidationError(
            `El precio local no puede diferir en más del 20% del precio base maestro ($${basePrice}). Rango permitido: $${minAllowed.toFixed(2)} a $${maxAllowed.toFixed(2)}.`
          );
        }
      }

      const oldPrice = Number(branchProduct.price);
      if (oldPrice !== newPrice) {
        // Registrar en price_change_logs
        await db('price_change_logs').insert({
          branch_id: branchId,
          product_id: productId,
          changed_by_id: currentUser.sub,
          old_price: oldPrice,
          new_price: newPrice,
          reason: 'Ajuste de precio local',
          created_at: db.fn.now(),
        });

        // Registrar en audit_logs
        await db('audit_logs').insert({
          user_id: currentUser.sub,
          branch_id: branchId,
          action: 'PRICE_UPDATE',
          entity_type: 'BRANCH_PRODUCT',
          entity_id: branchProduct.id,
          details: JSON.stringify({
            product_name: masterProduct.name,
            old_price: oldPrice,
            new_price: newPrice,
            base_price: basePrice,
          }),
          created_at: db.fn.now(),
        });
      }

      updateData.price = newPrice;
    }
    if (data.isAvailable !== undefined) updateData.is_available = data.isAvailable;

    await db('branch_products').where({ id: branchProduct.id }).update(updateData);
    return db('branch_products').where({ id: branchProduct.id }).first();
  }

  public static async removeProductFromBranch(
    currentUser: TokenPayload,
    branchId: number,
    productId: number
  ) {
    if (currentUser.role === 'MANAGER' && currentUser.branchId !== branchId) {
      throw new ForbiddenError('No tenés permisos para gestionar el menú de otra sucursal');
    }

    const branchProduct = await db('branch_products')
      .where({ branch_id: branchId, product_id: productId })
      .first();

    if (!branchProduct) {
      throw new NotFoundError('El producto no está en el menú de la sucursal');
    }

    await db('branch_products').where({ id: branchProduct.id }).del();
  }

  /**
   * Pausar o reanudar producto (BARISTA, MANAGER de la sucursal o ADMIN)
   */
  public static async toggleProductAvailability(
    currentUser: TokenPayload,
    branchId: number,
    productId: number,
    isAvailable: boolean,
    pausedReason?: string
  ) {
    if (['MANAGER', 'BARISTA'].includes(currentUser.role) && currentUser.branchId !== branchId) {
      throw new ForbiddenError('No tenés permisos para cambiar la disponibilidad en otra sucursal');
    }

    const branchProduct = await db('branch_products')
      .where({ branch_id: branchId, product_id: productId })
      .first();

    if (!branchProduct) {
      throw new NotFoundError('El producto no está en el menú de esta sucursal');
    }

    await db('branch_products')
      .where({ id: branchProduct.id })
      .update({
        is_available: isAvailable,
        paused_reason: isAvailable ? null : (pausedReason || 'Pausado temporalmente por falta de insumos'),
      });

    return db('branch_products').where({ id: branchProduct.id }).first();
  }
}
