import bcrypt from 'bcryptjs';
import { db } from '../../db/connection';
import { LoyaltyService } from '../loyalty/loyalty.service';
import {
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from '../../utils/errors';
import { getArgentinaBusinessDate } from '../../utils/date';
import { calculateTaxFromGross } from '../../utils/tax';
import { TokenPayload } from '../../utils/tokens';

export class OrdersService {
  /**
   * Crea un nuevo pedido con transacción atómica, numeración secuencial protegida y cálculo de precios del servidor
   */
  public static async createOrder(
    currentUser: TokenPayload,
    payload: {
      branchId: number;
      orderType: 'COUNTER' | 'DINE_IN' | 'TAKE_AWAY';
      notes?: string;
      paymentMethod?: 'CASH' | 'CARD' | 'QR' | 'TRANSFER';
      pointsToRedeem?: number;
      transferReference?: string;
      transferReceiptUrl?: string;
      items: Array<{ branchProductId: number; quantity: number; notes?: string }>;
    }
  ) {
    const isCustomer = currentUser.role === 'CUSTOMER';
    const isCashier = currentUser.role === 'CASHIER';

    // Verificación de sucursal para staff
    if (isCashier && currentUser.branchId !== payload.branchId) {
      throw new ForbiddenError('Un cajero solo puede emitir pedidos en su sucursal asignada');
    }

    const branch = await db('branches').where({ id: payload.branchId, is_active: true }).first();
    if (!branch) {
      throw new NotFoundError('La sucursal seleccionada no existe o está inactiva');
    }

    if (!branch.is_open && isCustomer) {
      throw new ValidationError('La sucursal se encuentra cerrada en este momento');
    }

    const businessDate = getArgentinaBusinessDate();
    const isMySql = db.client.config.client === 'mysql2';

    // Ejecutar todo dentro de una transaccion
    return db.transaction(async (trx) => {
      // 1. Numeración secuencial con bloqueo de fila
      let counterRecord: any;
      if (isMySql) {
        counterRecord = await trx('order_counters')
          .where({ branch_id: payload.branchId, business_date: businessDate })
          .forUpdate()
          .first();
      } else {
        counterRecord = await trx('order_counters')
          .where({ branch_id: payload.branchId, business_date: businessDate })
          .first();
      }

      let orderNumber = 1;
      if (!counterRecord) {
        await trx('order_counters').insert({
          branch_id: payload.branchId,
          business_date: businessDate,
          last_number: 1,
        });
        orderNumber = 1;
      } else {
        orderNumber = counterRecord.last_number + 1;
        await trx('order_counters')
          .where({ branch_id: payload.branchId, business_date: businessDate })
          .update({ last_number: orderNumber });
      }

      // 2. Obtener y validar productos desde la base de datos (NUNCA del cliente)
      const branchProductIds = payload.items.map((i) => i.branchProductId);
      const branchProducts = await trx('branch_products')
        .join('products', 'branch_products.product_id', 'products.id')
        .whereIn('branch_products.id', branchProductIds)
        .andWhere('branch_products.branch_id', payload.branchId)
        .select(
          'branch_products.id as branch_product_id',
          'branch_products.branch_id',
          'branch_products.price',
          'branch_products.is_available',
          'products.name as product_name',
          'products.is_active as product_is_active'
        );

      if (branchProducts.length !== payload.items.length) {
        throw new ValidationError('Uno o más productos no pertenecen al menú de esta sucursal');
      }

      // Validar disponibilidad
      for (const bp of branchProducts) {
        if (!bp.is_available || !bp.product_is_active) {
          throw new ValidationError(`El producto "${bp.product_name}" no se encuentra disponible actualmente`);
        }
      }

      // 3. Cálculo de importes (precios finales con IVA incluido según tasa de sucursal)
      let totalAmount = 0;
      const orderItemsToInsert: any[] = [];

      for (const item of payload.items) {
        const bp = branchProducts.find((p) => p.branch_product_id === item.branchProductId)!;
        const unitPrice = Number(bp.price);
        const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
        totalAmount += lineTotal;

        orderItemsToInsert.push({
          branch_id: payload.branchId,
          branch_product_id: bp.branch_product_id,
          product_name: bp.product_name,
          quantity: item.quantity,
          unit_price: unitPrice,
          notes: item.notes || null,
        });
      }

      totalAmount = Math.round(totalAmount * 100) / 100;

      let pointsRedeemed = 0;
      let pointsDiscount = 0;
      if (isCustomer && payload.pointsToRedeem && payload.pointsToRedeem > 0) {
        pointsDiscount = await LoyaltyService.redeemPoints(currentUser.sub, payload.pointsToRedeem, trx);
        pointsRedeemed = payload.pointsToRedeem;
        totalAmount = Math.max(0, Math.round((totalAmount - pointsDiscount) * 100) / 100);
      }

      const taxRate = Number(branch.tax_rate ?? 21.00);
      const taxDetails = calculateTaxFromGross(totalAmount, taxRate);

      // 4. Determinar estado inicial y de pago
      // - App del cliente: UNPAID (mostrador) o PENDING_VERIFICATION (Mercado Pago Transferencia / QR)
      // - Mostrador (CASHIER): PAID si seleccionó medio de pago, sino UNPAID
      const source = isCustomer ? 'APP' : 'COUNTER';
      let initialPaymentStatus = 'UNPAID';
      let initialPaymentMethod: string | null = payload.paymentMethod || null;
      let paidAt: any = null;

      if (!isCustomer && payload.paymentMethod) {
        initialPaymentStatus = 'PAID';
        paidAt = trx.fn.now();
      } else if (isCustomer && payload.paymentMethod === 'TRANSFER') {
        initialPaymentStatus = 'PENDING_VERIFICATION';
        initialPaymentMethod = 'TRANSFER';
      }

      // 5. Insertar cabecera de la orden
      const [orderId] = await trx('orders').insert({
        branch_id: payload.branchId,
        customer_id: isCustomer ? currentUser.sub : null,
        created_by: currentUser.sub,
        order_number: orderNumber,
        business_date: businessDate,
        status: 'PENDING',
        payment_status: initialPaymentStatus,
        payment_method: initialPaymentMethod,
        order_type: payload.orderType,
        source,
        subtotal: taxDetails.net,
        tax_amount: taxDetails.tax,
        total_amount: totalAmount,
        points_redeemed: pointsRedeemed,
        points_discount: pointsDiscount,
        notes: payload.notes || null,
        transfer_reference: payload.transferReference || null,
        transfer_receipt_url: payload.transferReceiptUrl || null,
        paid_at: paidAt,
        created_at: trx.fn.now(),
      });

      // 6. Insertar líneas del pedido
      for (const orderItem of orderItemsToInsert) {
        await trx('order_items').insert({
          order_id: orderId,
          ...orderItem,
        });
      }

      return OrdersService.getOrderByIdWithTrx(trx, orderId);
    });
  }

  /**
   * Obtiene un pedido por ID validando permisos de acceso (IDOR isolation)
   */
  public static async getOrderById(currentUser: TokenPayload, orderId: number) {
    const order = await this.getOrderByIdWithTrx(db, orderId);
    if (!order) {
      throw new NotFoundError('Pedido no encontrado');
    }

    // Aislamiento por rol
    if (currentUser.role === 'CUSTOMER') {
      if (order.customer_id !== currentUser.sub) {
        throw new ForbiddenError('No tenés permisos para visualizar pedidos de otros usuarios');
      }
    } else if (['CASHIER', 'BARISTA', 'MANAGER'].includes(currentUser.role)) {
      if (order.branch_id !== currentUser.branchId) {
        throw new ForbiddenError('No tenés permisos para visualizar pedidos de otra sucursal');
      }
    }

    return order;
  }

  /**
   * Lista pedidos según el rol del usuario con paginación y filtros
   */
  public static async listOrders(
    currentUser: TokenPayload,
    query: { page: number; limit: number; status?: string; date?: string; branchId?: number }
  ) {
    const { page, limit, status, date, branchId } = query;
    const offset = (page - 1) * limit;

    let baseQuery = db('orders')
      .join('branches', 'orders.branch_id', 'branches.id')
      .leftJoin('users as customer', 'orders.customer_id', 'customer.id')
      .select(
        'orders.*',
        'branches.name as branch_name',
        'branches.slug as branch_slug',
        'customer.full_name as customer_name',
        'customer.email as customer_email'
      );

    // Reglas de aislamiento de sucursal
    if (currentUser.role === 'CUSTOMER') {
      baseQuery = baseQuery.where('orders.customer_id', currentUser.sub);
    } else if (['CASHIER', 'BARISTA', 'MANAGER'].includes(currentUser.role)) {
      baseQuery = baseQuery.where('orders.branch_id', currentUser.branchId);
    } else if (currentUser.role === 'ADMIN' && branchId) {
      baseQuery = baseQuery.where('orders.branch_id', branchId);
    }

    if (status) {
      baseQuery = baseQuery.where('orders.status', status);
    }

    if (date) {
      baseQuery = baseQuery.where('orders.business_date', date);
    }

    const countResult = await baseQuery.clone().clearSelect().count('orders.id as count').first();
    const total = Number((countResult as any)?.count || 0);

    const orders = await baseQuery.orderBy('orders.id', 'desc').limit(limit).offset(offset);

    // Cargar items de cada pedido
    const orderIds = orders.map((o) => o.id);
    let allItems: any[] = [];
    if (orderIds.length > 0) {
      allItems = await db('order_items').whereIn('order_id', orderIds);
    }

    const formatted = orders.map((o) => ({
      ...o,
      subtotal: Number(o.subtotal),
      tax_amount: Number(o.tax_amount),
      total_amount: Number(o.total_amount),
      items: allItems
        .filter((item) => item.order_id === o.id)
        .map((item) => ({
          ...item,
          unit_price: Number(item.unit_price),
        })),
    }));

    return {
      data: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Cobro de pedido (CASHIER o ADMIN)
   */
  public static async payOrder(
    currentUser: TokenPayload,
    orderId: number,
    paymentMethod: 'CASH' | 'CARD' | 'QR' | 'TRANSFER'
  ) {
    return db.transaction(async (trx) => {
      const order = await trx('orders').where({ id: orderId }).forUpdate().first();
      if (!order) throw new NotFoundError('Pedido no encontrado');

      if (currentUser.role === 'CASHIER' && order.branch_id !== currentUser.branchId) {
        throw new ForbiddenError('No podés cobrar un pedido perteneciente a otra sucursal');
      }
      if (order.payment_status === 'PAID') {
        throw new UnprocessableEntityError('El pedido ya se encuentra cobrado');
      }
      if (order.status === 'CANCELLED') {
        throw new UnprocessableEntityError('No se puede cobrar un pedido cancelado');
      }

      let pointsEarned = 0;
      if (order.customer_id) {
        pointsEarned = Math.floor(Number(order.total_amount) / 100);
        if (pointsEarned > 0) {
          await LoyaltyService.awardPoints(order.customer_id, pointsEarned, trx);
        }
      }

      await trx('orders').where({ id: orderId }).update({
        payment_status: 'PAID',
        payment_method: paymentMethod,
        points_earned: pointsEarned,
        paid_at: trx.fn.now(),
      });

      return this.getOrderByIdWithTrx(trx, orderId);
    });
  }

  /**
   * Envío o actualización del comprobante de transferencia por el cliente
   */
  public static async submitTransferProof(
    currentUser: TokenPayload,
    orderId: number,
    payload: { transferReference: string; transferReceiptUrl: string }
  ) {
    return db.transaction(async (trx) => {
      const order = await trx('orders').where({ id: orderId }).forUpdate().first();
      if (!order) throw new NotFoundError('Pedido no encontrado');

      if (currentUser.role === 'CUSTOMER' && order.customer_id !== currentUser.sub) {
        throw new ForbiddenError('No tenés permisos para actualizar comprobantes de otro cliente');
      }

      if (order.status === 'CANCELLED') {
        throw new UnprocessableEntityError('No se puede adjuntar comprobante a un pedido cancelado');
      }

      if (order.payment_status === 'PAID') {
        throw new UnprocessableEntityError('Este pedido ya se encuentra cobrado y verificado');
      }

      await trx('orders').where({ id: orderId }).update({
        payment_method: 'TRANSFER',
        payment_status: 'PENDING_VERIFICATION',
        transfer_reference: payload.transferReference,
        transfer_receipt_url: payload.transferReceiptUrl,
        transfer_rejected_reason: null,
      });

      return this.getOrderByIdWithTrx(trx, orderId);
    });
  }

  /**
   * Verificación de comprobante de transferencia por Cajero, Encargado o Admin
   */
  public static async verifyTransferProof(
    currentUser: TokenPayload,
    orderId: number,
    payload: { approved: boolean; rejectionReason?: string }
  ) {
    if (!['CASHIER', 'MANAGER', 'ADMIN'].includes(currentUser.role)) {
      throw new ForbiddenError('Solo el personal de caja o encargados pueden verificar comprobantes de pago');
    }

    return db.transaction(async (trx) => {
      const order = await trx('orders').where({ id: orderId }).forUpdate().first();
      if (!order) throw new NotFoundError('Pedido no encontrado');

      if (['CASHIER', 'MANAGER'].includes(currentUser.role) && order.branch_id !== currentUser.branchId) {
        throw new ForbiddenError('No podés verificar pagos correspondientes a otra sucursal');
      }

      if (order.status === 'CANCELLED') {
        throw new UnprocessableEntityError('No se puede verificar el pago de un pedido cancelado');
      }

      if (payload.approved) {
        let pointsEarned = 0;
        if (order.customer_id) {
          pointsEarned = Math.floor(Number(order.total_amount) / 100);
          if (pointsEarned > 0) {
            await LoyaltyService.awardPoints(order.customer_id, pointsEarned, trx);
          }
        }

        await trx('orders').where({ id: orderId }).update({
          payment_status: 'PAID',
          payment_method: 'TRANSFER',
          points_earned: pointsEarned,
          paid_at: trx.fn.now(),
          transfer_verified_by_id: currentUser.sub,
          transfer_verified_at: trx.fn.now(),
          transfer_rejected_reason: null,
        });
      } else {
        await trx('orders').where({ id: orderId }).update({
          payment_status: 'UNPAID',
          transfer_rejected_reason: payload.rejectionReason || 'Comprobante no acreditado o ilegible',
        });
      }

      return this.getOrderByIdWithTrx(trx, orderId);
    });
  }

  /**
   * Listado de pedidos pendientes de verificación de transferencia para la sucursal
   */
  public static async listPendingTransfers(currentUser: TokenPayload, branchIdOverride?: number) {
    let branchId = currentUser.branchId;
    if (currentUser.role === 'ADMIN' && branchIdOverride) {
      branchId = branchIdOverride;
    }

    if (!branchId && currentUser.role !== 'ADMIN') {
      throw new ForbiddenError('Se requiere una sucursal asignada');
    }

    let query = db('orders')
      .join('branches', 'orders.branch_id', 'branches.id')
      .leftJoin('users as customer', 'orders.customer_id', 'customer.id')
      .where('orders.payment_status', 'PENDING_VERIFICATION')
      .whereNot('orders.status', 'CANCELLED')
      .select(
        'orders.*',
        'branches.name as branch_name',
        'branches.slug as branch_slug',
        'customer.full_name as customer_name',
        'customer.email as customer_email'
      );

    if (branchId) {
      query = query.where('orders.branch_id', branchId);
    }

    const orders = await query.orderBy('orders.id', 'asc');

    const orderIds = orders.map((o) => o.id);
    let allItems: any[] = [];
    if (orderIds.length > 0) {
      allItems = await db('order_items').whereIn('order_id', orderIds);
    }

    return orders.map((o) => ({
      ...o,
      subtotal: Number(o.subtotal),
      tax_amount: Number(o.tax_amount),
      total_amount: Number(o.total_amount),
      items: allItems.filter((i) => i.order_id === o.id).map((i) => ({
        ...i,
        unit_price: Number(i.unit_price),
      })),
    }));
  }

  /**
   * Transición de estado de pedido con validación de máquina de estados y permisos
   */
  public static async updateOrderStatus(
    currentUser: TokenPayload,
    orderId: number,
    nextStatus: 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED',
    cancelReason?: string
  ) {
    return db.transaction(async (trx) => {
      const order = await trx('orders').where({ id: orderId }).forUpdate().first();
      if (!order) throw new NotFoundError('Pedido no encontrado');

      if (['CASHIER', 'BARISTA', 'MANAGER'].includes(currentUser.role) && order.branch_id !== currentUser.branchId) {
        throw new ForbiddenError('No tenés permisos para modificar pedidos de otra sucursal');
      }

      const currentStatus = order.status;
      if (currentStatus === 'DELIVERED' || currentStatus === 'CANCELLED') {
        throw new UnprocessableEntityError(
          `El pedido ya se encuentra en estado final (${currentStatus}) y no puede modificarse`
        );
      }

      const updateFields: any = { status: nextStatus };
      if (nextStatus === 'CANCELLED') {
        if (!['ADMIN', 'MANAGER'].includes(currentUser.role)) {
          throw new ForbiddenError('Solo el encargado (MANAGER) o el administrador pueden cancelar pedidos');
        }
        updateFields.notes = order.notes
          ? `${order.notes} | Cancelación: ${cancelReason || 'Sin motivo especificado'}`
          : `Cancelación: ${cancelReason || 'Sin motivo especificado'}`;
      } else {
        const validTransitions: Record<string, string> = {
          PENDING: 'PREPARING',
          PREPARING: 'READY',
          READY: 'DELIVERED',
        };
        if (validTransitions[currentStatus] !== nextStatus) {
          throw new UnprocessableEntityError(
            `Transición no permitida: no se puede pasar de ${currentStatus} a ${nextStatus}`
          );
        }

        if (nextStatus === 'PREPARING') {
          if (order.payment_status !== 'PAID') {
            throw new UnprocessableEntityError('No se puede pasar a preparación un pedido que no ha sido pagado');
          }
        } else if (nextStatus === 'READY') {
          updateFields.ready_at = trx.fn.now();
        } else if (nextStatus === 'DELIVERED') {
          updateFields.delivered_at = trx.fn.now();
        }
      }

      await trx('orders').where({ id: orderId }).update(updateFields);
      return this.getOrderByIdWithTrx(trx, orderId);
    });
  }

  /**
   * Pantalla de comandas KDS para el Barista
   * Devuelve solo pedidos cobrados en estados PENDING, PREPARING o READY de su sucursal
   */
  public static async getKdsOrders(currentUser: TokenPayload, branchIdOverride?: number) {
    let branchId = currentUser.branchId;
    if (currentUser.role === 'ADMIN' && branchIdOverride) {
      branchId = branchIdOverride;
    }

    if (!branchId) {
      throw new ForbiddenError('Se requiere especificar una sucursal para consultar el KDS');
    }

    const orders = await db('orders')
      .leftJoin('users as customer', 'orders.customer_id', 'customer.id')
      .where('orders.branch_id', branchId)
      .andWhere('orders.payment_status', 'PAID')
      .whereIn('orders.status', ['PENDING', 'PREPARING', 'READY'])
      .select(
        'orders.id',
        'orders.branch_id',
        'orders.order_number',
        'orders.business_date',
        'orders.status',
        'orders.order_type',
        'orders.notes',
        'orders.created_at',
        'orders.paid_at',
        'orders.ready_at',
        'customer.full_name as customer_name'
      )
      .orderBy('orders.id', 'asc');

    const orderIds = orders.map((o) => o.id);
    let items: any[] = [];
    if (orderIds.length > 0) {
      items = await db('order_items').whereIn('order_id', orderIds);
    }

    return orders.map((o) => ({
      ...o,
      items: items.filter((i) => i.order_id === o.id),
    }));
  }

  /**
   * Anulación de comanda con Manager Override por PIN sin desloguear al cajero
   */
  public static async overrideCancelOrder(
    currentUser: TokenPayload,
    orderId: number,
    managerPin: string,
    reason: string,
    ipAddress?: string
  ) {
    return db.transaction(async (trx) => {
      const order = await trx('orders').where({ id: orderId }).forUpdate().first();
      if (!order) throw new NotFoundError('Pedido no encontrado');

      // Validar aislamiento de sucursal
      if (['CASHIER', 'BARISTA', 'MANAGER'].includes(currentUser.role) && order.branch_id !== currentUser.branchId) {
        throw new ForbiddenError('No tenés permisos para cancelar pedidos de otra sucursal');
      }

      if (order.status === 'DELIVERED' || order.status === 'CANCELLED') {
        throw new UnprocessableEntityError(`El pedido ya se encuentra en estado ${order.status} y no puede cancelarse`);
      }

      // Buscar encargados autorizados para esta sucursal (o administradores generales)
      const authorizedManagers = await trx('users')
        .where((qb) => {
          qb.where({ role: 'ADMIN' })
            .orWhere({ role: 'MANAGER', branch_id: order.branch_id });
        })
        .where('is_active', true)
        .whereNotNull('pin_hash');

      const assignedManagers = await trx('staff_branch_assignments')
        .join('users', 'staff_branch_assignments.user_id', 'users.id')
        .where('staff_branch_assignments.branch_id', order.branch_id)
        .where('staff_branch_assignments.is_active', true)
        .where('users.is_active', true)
        .whereNotNull('users.pin_hash')
        .select('users.*');

      const candidateManagers = [...authorizedManagers, ...assignedManagers];

      let verifiedManager: any = null;
      for (const m of candidateManagers) {
        if (m.pin_hash && (await bcrypt.compare(managerPin, m.pin_hash))) {
          verifiedManager = m;
          break;
        }
      }

      if (!verifiedManager) {
        throw new ForbiddenError('PIN de encargado inválido o no autorizado para esta sucursal');
      }

      const newNotes = order.notes
        ? `${order.notes} | Cancelación autorizada por ${verifiedManager.full_name}: ${reason}`
        : `Cancelación autorizada por ${verifiedManager.full_name}: ${reason}`;

      await trx('orders').where({ id: orderId }).update({
        status: 'CANCELLED',
        cancelled_by_id: verifiedManager.id,
        cancel_reason: reason,
        notes: newNotes,
      });

      // Registrar auditoría
      await trx('audit_logs').insert({
        user_id: currentUser.sub,
        branch_id: order.branch_id,
        action: 'ORDER_OVERRIDE_CANCEL',
        entity_type: 'ORDER',
        entity_id: order.id,
        details: JSON.stringify({
          operator_id: currentUser.sub,
          operator_role: currentUser.role,
          authorized_by_id: verifiedManager.id,
          authorized_by_name: verifiedManager.full_name,
          reason,
        }),
        ip_address: ipAddress || null,
      });

      const updatedOrder = await this.getOrderByIdWithTrx(trx, orderId);
      return {
        order: updatedOrder,
        authorizedBy: verifiedManager.full_name,
      };
    });
  }

  private static async getOrderByIdWithTrx(trx: any, orderId: number) {
    const order = await trx('orders')
      .join('branches', 'orders.branch_id', 'branches.id')
      .leftJoin('users as customer', 'orders.customer_id', 'customer.id')
      .where('orders.id', orderId)
      .select(
        'orders.*',
        'branches.name as branch_name',
        'branches.slug as branch_slug',
        'branches.tax_rate',
        'customer.full_name as customer_name',
        'customer.email as customer_email'
      )
      .first();

    if (!order) return null;

    const items = await trx('order_items').where({ order_id: orderId });

    return {
      ...order,
      subtotal: Number(order.subtotal),
      tax_amount: Number(order.tax_amount),
      total_amount: Number(order.total_amount),
      tax_rate: Number(order.tax_rate),
      items: items.map((i: any) => ({
        ...i,
        unit_price: Number(i.unit_price),
      })),
    };
  }
}
