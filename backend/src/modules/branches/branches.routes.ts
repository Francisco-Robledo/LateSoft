import { Router } from 'express';
import { BranchesController } from './branches.controller';
import { authenticate, authorize, requireBranchAccess } from '../../middlewares/auth';
import { validateRequest } from '../../middlewares/validate';
import {
  createBranchSchema,
  updateBranchSchema,
  addBranchProductSchema,
  updateBranchProductSchema,
  toggleProductAvailabilitySchema,
} from './branches.schema';

const router = Router();

// Endpoints públicos y de consulta (POST obligatorio)
router.post('/list', BranchesController.list);
router.post('/:id', BranchesController.getByIdOrSlug);
router.post('/:id/menu', BranchesController.getMenu);

// POST /branches : Si contiene datos de alta (name, address) y token ADMIN -> crea sucursal; si no, lista sucursales
router.post('/', async (req, res, next) => {
  if (req.body?.name && req.body?.address && !req.body?.isList) {
    return (authenticate as any)(req, res, () => {
      return (authorize('ADMIN') as any)(req, res, () => {
        return validateRequest(createBranchSchema)(req, res, () => {
          return BranchesController.create(req, res, next);
        });
      });
    });
  }
  return BranchesController.list(req, res, next);
});

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validateRequest(updateBranchSchema),
  BranchesController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  BranchesController.deactivate
);

// Gestión de Menú por Sucursal
router.post(
  '/:id/menu/:productId',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  requireBranchAccess((req) => Number(req.params.id)),
  validateRequest(addBranchProductSchema),
  BranchesController.addProduct
);

router.put(
  '/:id/menu/:productId',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  requireBranchAccess((req) => Number(req.params.id)),
  validateRequest(updateBranchProductSchema),
  BranchesController.updateProduct
);

router.patch(
  '/:id/menu/:productId',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  requireBranchAccess((req) => Number(req.params.id)),
  validateRequest(updateBranchProductSchema),
  BranchesController.updateProduct
);

router.delete(
  '/:id/menu/:productId',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  requireBranchAccess((req) => Number(req.params.id)),
  BranchesController.removeProduct
);

// Pausa rápida de disponibilidad en KDS / Menú (BARISTA, MANAGER, ADMIN)
router.patch(
  '/:id/menu/:productId/availability',
  authenticate,
  authorize('ADMIN', 'MANAGER', 'BARISTA'),
  requireBranchAccess((req) => Number(req.params.id)),
  validateRequest(toggleProductAvailabilitySchema),
  BranchesController.toggleAvailability
);

router.post(
  '/:id/menu/:productId/availability',
  authenticate,
  authorize('ADMIN', 'MANAGER', 'BARISTA'),
  requireBranchAccess((req) => Number(req.params.id)),
  validateRequest(toggleProductAvailabilitySchema),
  BranchesController.toggleAvailability
);

export default router;
