import { db } from '../../db/connection';
import { TokenPayload } from '../../utils/tokens';
import { ForbiddenError, NotFoundError, UnprocessableEntityError } from '../../utils/errors';

export class ShiftsService {
  /**
   * Obtiene el turno actualmente abierto en la sucursal con desglose de ventas en tiempo real
   */
  public static async getCurrentShift(currentUser: TokenPayload, branchIdOverride?: number) {
    let branchId = currentUser.branchId;
    if (currentUser.role === 'ADMIN' && branchIdOverride) {
      branchId = branchIdOverride;
    }

    if (!branchId) {
      throw new ForbiddenError('Se requiere especificar una sucursal para consultar el turno');
    }

    const shift = await db('cash_shifts')
      .where({ branch_id: branchId, status: 'OPEN' })
      .orderBy('id', 'desc')
      .first();

    if (!shift) {
      return { hasOpenShift: false, shift: null, summary: null };
    }

    // Calcular ventas por medio de pago acumuladas desde la apertura del turno
    const salesByMethod = await db('orders')
      .where({ branch_id: branchId, payment_status: 'PAID' })
      .where('paid_at', '>=', shift.opened_at)
      .groupBy('payment_method')
      .select('payment_method', db.raw('SUM(total_amount) as total'), db.raw('COUNT(id) as count'));

    let cashSales = 0;
    let cardSales = 0;
    let qrSales = 0;
    let transferSales = 0;
    let totalSales = 0;
    let ordersCount = 0;

    for (const row of salesByMethod) {
      const amount = Number(row.total) || 0;
      const count = Number(row.count) || 0;
      totalSales += amount;
      ordersCount += count;

      if (row.payment_method === 'CASH') cashSales += amount;
      else if (row.payment_method === 'CARD') cardSales += amount;
      else if (row.payment_method === 'QR') qrSales += amount;
      else if (row.payment_method === 'TRANSFER') transferSales += amount;
    }

    const initialCash = Number(shift.initial_cash);
    const expectedCash = initialCash + cashSales;

    const opener = await db('users').where({ id: shift.opened_by_id }).select('full_name', 'email').first();

    return {
      hasOpenShift: true,
      shift: {
        id: shift.id,
        branchId: shift.branch_id,
        openedAt: shift.opened_at,
        openedBy: opener?.full_name || 'Desconocido',
        initialCash,
        notes: shift.notes,
        status: shift.status,
      },
      summary: {
        initialCash,
        cashSales,
        cardSales,
        qrSales,
        transferSales,
        totalSales,
        ordersCount,
        expectedCash,
      },
    };
  }

  /**
   * Abre un nuevo turno de caja con fondo inicial en efectivo
   */
  public static async openShift(
    currentUser: TokenPayload,
    payload: { branchId: number; initialCash: number; notes?: string },
    ipAddress?: string
  ) {
    const { branchId, initialCash, notes } = payload;

    // Control de sucursal para staff
    if (['CASHIER', 'BARISTA', 'MANAGER'].includes(currentUser.role) && currentUser.branchId !== branchId) {
      throw new ForbiddenError('No podés abrir turno en una sucursal distinta a la tuya');
    }

    // Verificar si ya existe un turno abierto
    const existing = await db('cash_shifts')
      .where({ branch_id: branchId, status: 'OPEN' })
      .first();

    if (existing) {
      throw new UnprocessableEntityError('Ya existe un turno de caja abierto en esta sucursal');
    }

    const [shiftId] = await db('cash_shifts').insert({
      branch_id: branchId,
      opened_by_id: currentUser.sub,
      opened_at: db.fn.now(),
      initial_cash: initialCash,
      status: 'OPEN',
      notes: notes || null,
    });

    // Registrar en auditoría
    await db('audit_logs').insert({
      user_id: currentUser.sub,
      branch_id: branchId,
      action: 'SHIFT_OPEN',
      entity_type: 'SHIFT',
      entity_id: shiftId,
      details: JSON.stringify({ initialCash, notes }),
      ip_address: ipAddress || null,
    });

    return db('cash_shifts').where({ id: shiftId }).first();
  }

  /**
   * Cierra el turno de caja y realiza el arqueo (Efectivo real contado vs Sistema)
   */
  public static async closeShift(
    currentUser: TokenPayload,
    shiftId: number,
    payload: { finalCashCounted: number; notes?: string },
    ipAddress?: string
  ) {
    const { finalCashCounted, notes } = payload;

    const shift = await db('cash_shifts').where({ id: shiftId }).first();
    if (!shift) {
      throw new NotFoundError('Turno de caja no encontrado');
    }

    if (shift.status === 'CLOSED') {
      throw new UnprocessableEntityError('El turno ya se encuentra cerrado');
    }

    if (['CASHIER', 'BARISTA', 'MANAGER'].includes(currentUser.role) && currentUser.branchId !== shift.branch_id) {
      throw new ForbiddenError('No tenés permisos para cerrar un turno de otra sucursal');
    }

    // Calcular ventas en efectivo durante el turno
    const cashSalesRow = await db('orders')
      .where({
        branch_id: shift.branch_id,
        payment_status: 'PAID',
        payment_method: 'CASH',
      })
      .where('paid_at', '>=', shift.opened_at)
      .sum('total_amount as total')
      .first();

    const cashSales = Number((cashSalesRow as any)?.total || 0);
    const initialCash = Number(shift.initial_cash);
    const finalCashExpected = initialCash + cashSales;
    const cashDifference = finalCashCounted - finalCashExpected;

    const closedNotes = notes
      ? `${shift.notes ? shift.notes + ' | ' : ''}Cierre: ${notes}`
      : shift.notes;

    await db('cash_shifts').where({ id: shiftId }).update({
      status: 'CLOSED',
      closed_by_id: currentUser.sub,
      closed_at: db.fn.now(),
      final_cash_expected: finalCashExpected,
      final_cash_counted: finalCashCounted,
      cash_difference: cashDifference,
      notes: closedNotes,
    });

    // Registrar en auditoría
    await db('audit_logs').insert({
      user_id: currentUser.sub,
      branch_id: shift.branch_id,
      action: 'SHIFT_CLOSE',
      entity_type: 'SHIFT',
      entity_id: shiftId,
      details: JSON.stringify({
        initialCash,
        cashSales,
        finalCashExpected,
        finalCashCounted,
        cashDifference,
        notes,
      }),
      ip_address: ipAddress || null,
    });

    return {
      shiftId,
      branchId: shift.branch_id,
      status: 'CLOSED',
      initialCash,
      cashSales,
      finalCashExpected,
      finalCashCounted,
      cashDifference,
      notes: closedNotes,
    };
  }
}
