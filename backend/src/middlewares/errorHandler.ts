import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ZodError } from 'zod';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Manejo de errores de validacion Zod
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));

    console.error('[VALIDATION_ERROR]', JSON.stringify(details));

    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Los datos enviados contienen errores de validación',
        details,
      },
    });
    return;
  }

  // Manejo de errores de la aplicacion (AppError)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details || [],
      },
    });
    return;
  }

  // Manejo de errores de base de datos o sintaxis inesperada
  console.error('[UNHANDLED_ERROR]', err);

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocurrió un error inesperado en el servidor. Por favor intentá más tarde.',
      details: [],
    },
  });
}
