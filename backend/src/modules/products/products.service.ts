import { db } from '../../db/connection';
import { NotFoundError, ValidationError } from '../../utils/errors';

export class ProductsService {
  public static async listProducts(query: {
    categoryId?: number;
    search?: string;
    page: number;
    limit: number;
  }) {
    const { categoryId, search, page, limit } = query;
    const offset = (page - 1) * limit;

    let baseQuery = db('products')
      .join('categories', 'products.category_id', 'categories.id')
      .select(
        'products.*',
        'categories.name as category_name',
        'categories.icon as category_icon'
      )
      .where('products.is_active', true);

    if (categoryId) {
      baseQuery = baseQuery.where('products.category_id', categoryId);
    }

    if (search) {
      baseQuery = baseQuery.where('products.name', 'like', `%${search}%`);
    }

    const countResult = await baseQuery.clone().clearSelect().count('products.id as count').first();
    const total = Number((countResult as any)?.count || 0);

    const rawData = await baseQuery.orderBy('products.id', 'desc').limit(limit).offset(offset);
    const data = rawData.map((p) => ({
      ...p,
      base_price: Number(p.base_price),
      is_active: Boolean(p.is_active),
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async getProductById(id: number) {
    const product = await db('products')
      .join('categories', 'products.category_id', 'categories.id')
      .select(
        'products.*',
        'categories.name as category_name',
        'categories.icon as category_icon'
      )
      .where('products.id', id)
      .first();

    if (!product) {
      throw new NotFoundError('Producto no encontrado');
    }

    return {
      ...product,
      base_price: Number(product.base_price),
      is_active: Boolean(product.is_active),
    };
  }

  public static async createProduct(payload: {
    categoryId: number;
    name: string;
    description: string;
    imageUrl: string;
    basePrice: number;
    exclusiveBranchId?: number | null;
  }) {
    // Verificar categoria existente
    const category = await db('categories').where({ id: payload.categoryId }).first();
    if (!category) {
      throw new ValidationError('La categoría especificada no existe');
    }

    if (payload.exclusiveBranchId) {
      const branch = await db('branches').where({ id: payload.exclusiveBranchId }).first();
      if (!branch) {
        throw new ValidationError('La sucursal exclusiva especificada no existe');
      }
    }

    const [id] = await db('products').insert({
      category_id: payload.categoryId,
      name: payload.name,
      description: payload.description,
      image_url: payload.imageUrl,
      base_price: payload.basePrice,
      exclusive_branch_id: payload.exclusiveBranchId || null,
      is_active: true,
    });

    return this.getProductById(id);
  }

  public static async updateProduct(id: number, payload: any) {
    const existing = await db('products').where({ id }).first();
    if (!existing) {
      throw new NotFoundError('Producto no encontrado');
    }

    const updateData: any = {};
    if (payload.categoryId !== undefined) updateData.category_id = payload.categoryId;
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.description !== undefined) updateData.description = payload.description;
    if (payload.imageUrl !== undefined) updateData.image_url = payload.imageUrl;
    if (payload.basePrice !== undefined) updateData.base_price = payload.basePrice;
    if (payload.exclusiveBranchId !== undefined) updateData.exclusive_branch_id = payload.exclusiveBranchId;
    if (payload.isActive !== undefined) updateData.is_active = payload.isActive;

    await db('products').where({ id }).update(updateData);
    return this.getProductById(id);
  }

  public static async deleteProduct(id: number) {
    const existing = await db('products').where({ id }).first();
    if (!existing) {
      throw new NotFoundError('Producto no encontrado');
    }

    // Baja logica
    await db('products').where({ id }).update({ is_active: false });
  }
}
