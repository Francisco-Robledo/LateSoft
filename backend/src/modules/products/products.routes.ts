import { Router } from 'express';
import { ProductsController } from './products.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validateRequest } from '../../middlewares/validate';
import {
  createProductSchema,
  updateProductSchema,
  queryProductsSchema,
} from './products.schema';

const router = Router();

router.post('/list', validateRequest(queryProductsSchema), ProductsController.list);
router.post('/:id', ProductsController.getById);

// POST /products : Si contiene campos requeridos de alta (name, basePrice, categoryId) -> crea producto; si no, lista productos
router.post('/', async (req, res, next) => {
  if (req.body?.name && req.body?.basePrice !== undefined && req.body?.categoryId && !req.body?.isList) {
    return (authenticate as any)(req, res, () => {
      return (authorize('ADMIN') as any)(req, res, () => {
        return validateRequest(createProductSchema)(req, res, () => {
          return ProductsController.create(req, res, next);
        });
      });
    });
  }
  return validateRequest(queryProductsSchema)(req, res, () => {
    return ProductsController.list(req, res, next);
  });
});

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  validateRequest(updateProductSchema),
  ProductsController.update
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  ProductsController.delete
);

export default router;
