import { Router } from 'express';
import { LoyaltyController } from './loyalty.controller';
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

router.use(authenticate);

// Consultar saldo de fidelización del cliente (POST obligatorio)
router.post('/me', authorize('CUSTOMER'), LoyaltyController.getMyPoints);

export default router;
