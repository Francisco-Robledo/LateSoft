import { Router } from 'express';
import { ShiftsController } from './shifts.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validateRequest } from '../../middlewares/validate';
import { openShiftSchema, closeShiftSchema } from './shifts.schema';

const router = Router();

router.use(authenticate);

// Consultar turno actual (POST obligatorio)
router.post(
  '/current',
  authorize('CASHIER', 'BARISTA', 'MANAGER', 'ADMIN'),
  ShiftsController.getCurrent
);

// Abrir turno con fondo inicial
router.post(
  '/open',
  authorize('CASHIER', 'MANAGER', 'ADMIN'),
  validateRequest(openShiftSchema),
  ShiftsController.open
);

// Cerrar turno y realizar arqueo
router.post(
  '/:id/close',
  authorize('CASHIER', 'MANAGER', 'ADMIN'),
  validateRequest(closeShiftSchema),
  ShiftsController.close
);

export default router;
