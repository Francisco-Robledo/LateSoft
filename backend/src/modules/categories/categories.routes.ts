import { Router } from 'express';
import { CategoriesController } from './categories.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validateRequest } from '../../middlewares/validate';
import { createCategorySchema, updateCategorySchema } from './categories.schema';

const router = Router();

router.post('/list', CategoriesController.list);

// POST /categories : Si contiene name y no es isList -> crea categoría (ADMIN); si no, lista categorías
router.post('/', async (req, res, next) => {
  if (req.body?.name && !req.body?.isList) {
    return (authenticate as any)(req, res, () => {
      return (authorize('ADMIN') as any)(req, res, () => {
        return validateRequest(createCategorySchema)(req, res, () => {
          return CategoriesController.create(req, res, next);
        });
      });
    });
  }
  return CategoriesController.list(req, res, next);
});

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validateRequest(updateCategorySchema),
  CategoriesController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  CategoriesController.delete
);

export default router;
