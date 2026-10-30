import { Router } from 'express';
import { ReportsController } from './reports.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validateRequest } from '../../middlewares/validate';
import { salesReportSchema, topProductsReportSchema } from './reports.schema';

const router = Router();

router.use(authenticate, authorize('ADMIN', 'MANAGER'));

router.post('/sales', validateRequest(salesReportSchema), ReportsController.getSales);
router.post('/top-products', validateRequest(topProductsReportSchema), ReportsController.getTopProducts);

export default router;
