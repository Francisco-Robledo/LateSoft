import { Router } from 'express';
import { AuditController } from './audit.controller';
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

router.use(authenticate);

// Solo el rol ADMIN puede auditar acciones globales (POST obligatorio)
router.post('/', authorize('ADMIN'), AuditController.list);
router.post('/list', authorize('ADMIN'), AuditController.list);

export default router;
