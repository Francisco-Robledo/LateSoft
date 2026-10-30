import path from 'path';
import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { globalRateLimiter } from './middlewares/rateLimiter';
import { errorHandler } from './middlewares/errorHandler';
import { NotFoundError } from './utils/errors';

// Importación de módulos de rutas
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import branchesRoutes from './modules/branches/branches.routes';
import categoriesRoutes from './modules/categories/categories.routes';
import productsRoutes from './modules/products/products.routes';
import ordersRoutes from './modules/orders/orders.routes';
import favoritesRoutes from './modules/favorites/favorites.routes';
import reportsRoutes from './modules/reports/reports.routes';
import shiftsRoutes from './modules/shifts/shifts.routes';
import auditRoutes from './modules/audit/audit.routes';
import loyaltyRoutes from './modules/loyalty/loyalty.routes';
import uploadRoutes from './modules/upload/upload.routes';

const app: Express = express();

// Seguridad HTTP con Helmet permitiendo servir imágenes
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Habilitación de CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Servir archivos estáticos subidos
app.use('/uploads', express.static(path.resolve(__dirname, '../../uploads')));

// Body parser (hasta 10MB para subida de fotos en base64)
app.use(express.json({ limit: '10mb' }));

// Logging de peticiones
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[API REQUEST] ${req.method} ${req.url} - body:`, JSON.stringify(req.body));
  next();
});

// Rate limit global
app.use(globalRateLimiter);

// REGLA ARQUITECTÓNICA DEL PROYECTO: Prohibido el uso de GET en la API (todo debe ser POST)
// Se exceptúan únicamente los archivos estáticos de /uploads requeridos por componentes <Image /> nativos.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET' && !req.path.startsWith('/uploads')) {
    return res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'El método GET está estrictamente prohibido en esta arquitectura. Toda comunicación API debe utilizar POST.',
      },
    });
  }
  next();
});

// Sincronización automática de parámetros POST al query context para compatibilidad de filtros y servicios
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.method === 'POST' && req.body && typeof req.body === 'object') {
    req.query = { ...req.body, ...req.query };
  }
  next();
});

// Endpoint de salud del servidor (POST obligatorio)
app.post('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Enrutamiento de la API REST
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/branches', branchesRoutes);
app.use('/categories', categoriesRoutes);
app.use('/products', productsRoutes);
app.use('/orders', ordersRoutes);
app.use('/me/favorite-branches', favoritesRoutes);
app.use('/reports', reportsRoutes);
app.use('/shifts', shiftsRoutes);
app.use('/audit', auditRoutes);
app.use('/loyalty', loyaltyRoutes);
app.use('/upload', uploadRoutes);

// Manejador para rutas inexistentes (404)
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new NotFoundError('El endpoint solicitado no existe'));
});

// Manejador centralizado de errores
app.use(errorHandler);

export default app;
