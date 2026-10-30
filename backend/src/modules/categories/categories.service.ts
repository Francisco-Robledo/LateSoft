import { db } from '../../db/connection';
import { NotFoundError } from '../../utils/errors';

export class CategoriesService {
  public static async listCategories(includeInactive = false) {
    let query = db('categories').select('*');
    if (!includeInactive) {
      query = query.where({ is_active: true });
    }
    return query.orderBy('sort_order', 'asc');
  }

  public static async createCategory(payload: { name: string; icon: string; sortOrder: number }) {
    const [id] = await db('categories').insert({
      name: payload.name,
      icon: payload.icon,
      sort_order: payload.sortOrder,
      is_active: true,
    });
    return db('categories').where({ id }).first();
  }

  public static async updateCategory(id: number, payload: Partial<{ name: string; icon: string; sortOrder: number; isActive: boolean }>) {
    const existing = await db('categories').where({ id }).first();
    if (!existing) {
      throw new NotFoundError('Categoría no encontrada');
    }

    const updateData: any = {};
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.icon !== undefined) updateData.icon = payload.icon;
    if (payload.sortOrder !== undefined) updateData.sort_order = payload.sortOrder;
    if (payload.isActive !== undefined) updateData.is_active = payload.isActive;

    await db('categories').where({ id }).update(updateData);
    return db('categories').where({ id }).first();
  }

  public static async deleteCategory(id: number) {
    const existing = await db('categories').where({ id }).first();
    if (!existing) {
      throw new NotFoundError('Categoría no encontrada');
    }
    await db('categories').where({ id }).update({ is_active: false });
  }
}
