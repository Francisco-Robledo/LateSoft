import { Router } from 'express';
import { FavoritesController } from './favorites.controller';
import { authenticate } from '../../middlewares/auth';
import { validateRequest } from '../../middlewares/validate';
import { addFavoriteSchema } from './favorites.schema';

const router = Router();

// Cualquier usuario autenticado (Cliente, Admin, etc.) puede consultar y gestionar sus sucursales favoritas
router.use(authenticate);

router.post('/list', FavoritesController.list);

// POST / : Si contiene branchId agrega a favoritos; si no, lista favoritos
router.post('/', async (req, res, next) => {
  if (req.body?.branchId && !req.body?.isList) {
    return validateRequest(addFavoriteSchema)(req, res, () => {
      return FavoritesController.add(req, res, next);
    });
  }
  return FavoritesController.list(req, res, next);
});
router.delete('/:branchId', FavoritesController.remove);

export default router;
