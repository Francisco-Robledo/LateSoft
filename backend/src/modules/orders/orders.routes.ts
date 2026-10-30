import { Router } from 'express';
import { OrdersController } from './orders.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validateRequest } from '../../middlewares/validate';
import {
  createOrderSchema,
  updateOrderStatusSchema,
  payOrderSchema,
  queryOrdersSchema,
  overrideCancelOrderSchema,
  submitTransferProofSchema,
  verifyTransferProofSchema,
  pendingTransfersSchema,
} from './orders.schema';

const router = Router();

router.use(authenticate);

// Pantalla KDS para el Barista (POST obligatorio)
router.post(
  '/kds',
  authorize('BARISTA', 'MANAGER', 'ADMIN'),
  OrdersController.getKds
);

// Listar y consultar órdenes (POST obligatorio)
router.post(
  '/list',
  validateRequest(queryOrdersSchema),
  OrdersController.list
);

// Listado de transferencias pendientes de verificación para la sucursal (debe ir antes de /:id)
router.post(
  '/pending-transfers',
  authorize('CASHIER', 'MANAGER', 'ADMIN'),
  validateRequest(pendingTransfersSchema),
  OrdersController.listPendingTransfers
);

router.post(
  '/:id',
  OrdersController.getById
);

// Crear pedido o listar pedidos en '/'
router.post(
  '/',
  authorize('CUSTOMER', 'CASHIER', 'ADMIN'),
  async (req, res, next) => {
    if (req.body?.items && Array.isArray(req.body.items)) {
      return validateRequest(createOrderSchema)(req, res, () => {
        return OrdersController.create(req, res, next);
      });
    }
    return validateRequest(queryOrdersSchema)(req, res, () => {
      return OrdersController.list(req, res, next);
    });
  }
);

// Cobrar pedido (CASHIER o ADMIN)
router.post(
  '/:id/pay',
  authorize('CASHIER', 'ADMIN'),
  validateRequest(payOrderSchema),
  OrdersController.pay
);

// Cambiar estado del pedido (PREPARING, READY, DELIVERED por Staff; CANCELLED por MANAGER/ADMIN)
router.patch(
  '/:id/status',
  authorize('BARISTA', 'CASHIER', 'MANAGER', 'ADMIN'),
  validateRequest(updateOrderStatusSchema),
  OrdersController.updateStatus
);

router.post(
  '/:id/status',
  authorize('BARISTA', 'CASHIER', 'MANAGER', 'ADMIN'),
  validateRequest(updateOrderStatusSchema),
  OrdersController.updateStatus
);

// Cancelar comanda con Manager Override por PIN (sin desloguear al cajero)
router.post(
  '/:id/override-cancel',
  authorize('CASHIER', 'BARISTA', 'MANAGER', 'ADMIN'),
  validateRequest(overrideCancelOrderSchema),
  OrdersController.overrideCancel
);

// Comprobante de transferencia Mercado Pago (Subida/Actualización por Cliente o Staff)
router.post(
  '/:id/transfer-proof',
  authorize('CUSTOMER', 'CASHIER', 'ADMIN'),
  validateRequest(submitTransferProofSchema),
  OrdersController.submitTransferProof
);

// Verificación y aprobación/rechazo de transferencia por Cajero o Encargado
router.post(
  '/:id/verify-transfer',
  authorize('CASHIER', 'MANAGER', 'ADMIN'),
  validateRequest(verifyTransferProofSchema),
  OrdersController.verifyTransferProof
);

export default router;
