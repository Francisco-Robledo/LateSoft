import { db } from '../../db/connection';
import { ForbiddenError } from '../../utils/errors';
import { TokenPayload } from '../../utils/tokens';

export class ReportsService {
  public static async getSalesReport(
    currentUser: TokenPayload,
    filters: { branchId?: number; from?: string; to?: string }
  ) {
    let targetBranchId = filters.branchId;

    if (currentUser.role === 'MANAGER') {
      if (targetBranchId && targetBranchId !== currentUser.branchId) {
        throw new ForbiddenError('No tenés autorización para consultar reportes de otra sucursal');
      }
      targetBranchId = currentUser.branchId!;
    } else if (currentUser.role !== 'ADMIN') {
      throw new ForbiddenError('No tenés permisos para visualizar reportes de ventas');
    }

    let query = db('orders')
      .where('orders.payment_status', 'PAID')
      .whereNot('orders.status', 'CANCELLED');

    if (targetBranchId) {
      query = query.where('orders.branch_id', targetBranchId);
    }

    if (filters.from) {
      query = query.where('orders.business_date', '>=', filters.from);
    }

    if (filters.to) {
      query = query.where('orders.business_date', '<=', filters.to);
    }

    // 1. Resumen global
    const [summaryResult] = await query.clone().select(
      db.raw('COUNT(orders.id) as total_orders'),
      db.raw('COALESCE(SUM(orders.total_amount), 0) as total_revenue'),
      db.raw('COALESCE(SUM(orders.tax_amount), 0) as total_tax'),
      db.raw('COALESCE(SUM(orders.subtotal), 0) as total_net')
    );

    const totalOrders = Number(summaryResult.total_orders);
    const totalRevenue = Number(summaryResult.total_revenue);
    const totalTax = Number(summaryResult.total_tax);
    const totalNet = Number(summaryResult.total_net);
    const averageTicket = totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0;

    // 2. Ventas por fecha comercial
    const salesByDateRaw = await query
      .clone()
      .select(
        'orders.business_date',
        db.raw('COUNT(orders.id) as orders_count'),
        db.raw('SUM(orders.total_amount) as daily_revenue')
      )
      .groupBy('orders.business_date')
      .orderBy('orders.business_date', 'asc');

    const salesByDate = salesByDateRaw.map((row) => ({
      business_date: row.business_date,
      orders_count: Number(row.orders_count),
      daily_revenue: Number(row.daily_revenue),
    }));

    // 3. Desglose por medio de pago
    const paymentBreakdownRaw = await query
      .clone()
      .select(
        'orders.payment_method',
        db.raw('COUNT(orders.id) as orders_count'),
        db.raw('SUM(orders.total_amount) as total_amount')
      )
      .groupBy('orders.payment_method');

    const paymentBreakdown = paymentBreakdownRaw.map((row) => ({
      payment_method: row.payment_method || 'SIN_DEFINIR',
      orders_count: Number(row.orders_count),
      total_amount: Number(row.total_amount),
    }));

    // 4. Comparativa por sucursal (si es ADMIN)
    let branchComparison: any[] = [];
    if (currentUser.role === 'ADMIN' && !targetBranchId) {
      const branchesRaw = await query
        .clone()
        .join('branches', 'orders.branch_id', 'branches.id')
        .select(
          'branches.id as branch_id',
          'branches.name as branch_name',
          db.raw('COUNT(orders.id) as orders_count'),
          db.raw('SUM(orders.total_amount) as total_revenue')
        )
        .groupBy('branches.id', 'branches.name')
        .orderBy('total_revenue', 'desc');

      branchComparison = branchesRaw.map((row) => ({
        branch_id: row.branch_id,
        branch_name: row.branch_name,
        orders_count: Number(row.orders_count),
        total_revenue: Number(row.total_revenue),
      }));
    }

    return {
      summary: {
        totalOrders,
        totalRevenue,
        totalTax,
        totalNet,
        averageTicket,
      },
      salesByDate,
      paymentBreakdown,
      branchComparison,
    };
  }

  public static async getTopProductsReport(
    currentUser: TokenPayload,
    filters: { branchId?: number; from?: string; to?: string; limit: number }
  ) {
    let targetBranchId = filters.branchId;

    if (currentUser.role === 'MANAGER') {
      if (targetBranchId && targetBranchId !== currentUser.branchId) {
        throw new ForbiddenError('No tenés autorización para consultar reportes de otra sucursal');
      }
      targetBranchId = currentUser.branchId!;
    } else if (currentUser.role !== 'ADMIN') {
      throw new ForbiddenError('No tenés permisos para visualizar reportes');
    }

    let query = db('order_items')
      .join('orders', 'order_items.order_id', 'orders.id')
      .where('orders.payment_status', 'PAID')
      .whereNot('orders.status', 'CANCELLED');

    if (targetBranchId) {
      query = query.where('orders.branch_id', targetBranchId);
    }

    if (filters.from) {
      query = query.where('orders.business_date', '>=', filters.from);
    }

    if (filters.to) {
      query = query.where('orders.business_date', '<=', filters.to);
    }

    const rawData = await query
      .select(
        'order_items.product_name',
        db.raw('SUM(order_items.quantity) as total_quantity'),
        db.raw('SUM(order_items.quantity * order_items.unit_price) as total_revenue')
      )
      .groupBy('order_items.product_name')
      .orderBy('total_quantity', 'desc')
      .limit(filters.limit);

    return rawData.map((row) => ({
      product_name: row.product_name,
      total_quantity: Number(row.total_quantity),
      total_revenue: Math.round(Number(row.total_revenue) * 100) / 100,
    }));
  }
}
