import { Router } from 'express';
import { UsersController } from './users.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validateRequest } from '../../middlewares/validate';
import {
  createUserSchema,
  updateUserSchema,
  updateMeSchema,
  queryUsersSchema,
} from './users.schema';

const router = Router();

router.use(authenticate);

// Auto-actualizacion de perfil del usuario logueado (PATCH y POST)
router.patch(
  '/me',
  validateRequest(updateMeSchema),
  UsersController.updateMe
);

router.post(
  '/me',
  validateRequest(updateMeSchema),
  UsersController.updateMe
);

// Administracion de usuarios (ADMIN y MANAGER) - POST obligatorio
router.post(
  '/list',
  authorize('ADMIN', 'MANAGER'),
  validateRequest(queryUsersSchema),
  UsersController.list
);

router.post(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  UsersController.getById
);

// POST /users : Si contiene email y password -> crea usuario; si no, lista usuarios
router.post(
  '/',
  authorize('ADMIN', 'MANAGER'),
  async (req, res, next) => {
    if (req.body?.email && req.body?.password && !req.body?.isList) {
      return validateRequest(createUserSchema)(req, res, () => {
        return UsersController.create(req, res, next);
      });
    }
    return validateRequest(queryUsersSchema)(req, res, () => {
      return UsersController.list(req, res, next);
    });
  }
);

router.put(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  validateRequest(updateUserSchema),
  UsersController.update
);

router.post(
  '/:id/update',
  authorize('ADMIN', 'MANAGER'),
  validateRequest(updateUserSchema),
  UsersController.update
);

router.delete(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  UsersController.deactivate
);

router.post(
  '/:id/delete',
  authorize('ADMIN', 'MANAGER'),
  UsersController.deactivate
);

export default router;
