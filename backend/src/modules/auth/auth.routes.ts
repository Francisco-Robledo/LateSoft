import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validateRequest } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/auth';
import { authRateLimiter } from '../../middlewares/rateLimiter';
import {
  registerSchema,
  loginSchema,
  socialLoginSchema,
  refreshSchema,
  logoutSchema,
} from './auth.schema';

const router = Router();

router.post(
  '/register',
  authRateLimiter,
  validateRequest(registerSchema),
  AuthController.register
);

router.post(
  '/login',
  authRateLimiter,
  validateRequest(loginSchema),
  AuthController.login
);

router.post(
  '/social',
  authRateLimiter,
  validateRequest(socialLoginSchema),
  AuthController.socialLogin
);

router.post(
  '/refresh',
  validateRequest(refreshSchema),
  AuthController.refreshToken
);

router.post(
  '/logout',
  validateRequest(logoutSchema),
  AuthController.logout
);

router.post(
  '/me',
  authenticate,
  AuthController.getMe
);

export default router;
