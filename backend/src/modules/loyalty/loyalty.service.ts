import { db } from '../../db/connection';
import { ValidationError } from '../../utils/errors';

export class LoyaltyService {
  /**
   * Obtiene el saldo y puntos históricos del cliente
   */
  public static async getBalance(customerId: number) {
    const row = await db('customer_loyalty').where({ customer_id: customerId }).first();
    return {
      pointsBalance: row ? Number(row.points_balance) : 0,
      lifetimePoints: row ? Number(row.lifetime_points) : 0,
    };
  }

  /**
   * Acredita puntos acumulados tras el pago de una orden ($100 ARS = 1 punto)
   */
  public static async awardPoints(customerId: number, points: number, trx: any = db) {
    if (points <= 0) return;

    const existing = await trx('customer_loyalty').where({ customer_id: customerId }).first();

    if (existing) {
      await trx('customer_loyalty')
        .where({ id: existing.id })
        .update({
          points_balance: existing.points_balance + points,
          lifetime_points: existing.lifetime_points + points,
          updated_at: trx.fn.now(),
        });
    } else {
      await trx('customer_loyalty').insert({
        customer_id: customerId,
        points_balance: points,
        lifetime_points: points,
        updated_at: trx.fn.now(),
      });
    }
  }

  /**
   * Descuenta puntos canjeados en el checkout (1 punto = $10 ARS)
   */
  public static async redeemPoints(customerId: number, pointsToRedeem: number, trx: any) {
    if (pointsToRedeem <= 0) return 0;

    const row = await trx('customer_loyalty').where({ customer_id: customerId }).forUpdate().first();
    const currentBalance = row ? Number(row.points_balance) : 0;

    if (currentBalance < pointsToRedeem) {
      throw new ValidationError(
        `Saldo insuficiente de puntos. Tenés ${currentBalance} puntos disponibles pero intentaste canjear ${pointsToRedeem}.`
      );
    }

    await trx('customer_loyalty')
      .where({ customer_id: customerId })
      .update({
        points_balance: currentBalance - pointsToRedeem,
        updated_at: trx.fn.now(),
      });

    return pointsToRedeem * 10; // Cada punto descuenta $10 ARS
  }
}
