import { db } from '../../db/connection';
import { NotFoundError } from '../../utils/errors';

export class FavoritesService {
  public static async listFavorites(customerId: number) {
    const favorites = await db('favorite_branches')
      .join('branches', 'favorite_branches.branch_id', 'branches.id')
      .where('favorite_branches.customer_id', customerId)
      .andWhere('branches.is_active', true)
      .select('branches.*');

    return favorites.map((b) => ({
      ...b,
      opening_hours: typeof b.opening_hours === 'string' ? JSON.parse(b.opening_hours) : b.opening_hours,
      latitude: Number(b.latitude),
      longitude: Number(b.longitude),
      tax_rate: Number(b.tax_rate),
    }));
  }

  public static async addFavorite(customerId: number, branchId: number) {
    const branch = await db('branches').where({ id: branchId, is_active: true }).first();
    if (!branch) {
      throw new NotFoundError('Sucursal no encontrada');
    }

    const existing = await db('favorite_branches')
      .where({ customer_id: customerId, branch_id: branchId })
      .first();

    if (!existing) {
      await db('favorite_branches').insert({
        customer_id: customerId,
        branch_id: branchId,
      });
    }
  }

  public static async removeFavorite(customerId: number, branchId: number) {
    await db('favorite_branches')
      .where({ customer_id: customerId, branch_id: branchId })
      .del();
  }
}
