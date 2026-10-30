import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { verifyAccessToken, TokenPayload } from '../utils/tokens';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Encabezado de autorización ausente o con formato inválido');
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (_err) {
    throw new UnauthorizedError('El token de acceso expiró o no es válido');
  }
}

export function authorize(...roles: Array<'ADMIN' | 'MANAGER' | 'CASHIER' | 'BARISTA' | 'CUSTOMER'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    const userRoles = [req.user.role, ...(req.user.assignedRoles || [])];
    const hasRole = roles.some((r) => userRoles.includes(r));

    if (!hasRole) {
      throw new ForbiddenError(`Tu rol (${req.user.role}) no tiene permisos para realizar esta operación`);
    }

    next();
  };
}

export function requireBranchAccess(
  getBranchId?: (req: Request) => number | undefined
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    // ADMIN siempre tiene acceso a todas las sucursales
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Extraer branchId de destino
    let targetBranchId: number | undefined;
    if (getBranchId) {
      targetBranchId = getBranchId(req);
    } else {
      const fromParam = req.params.branchId || req.params.id;
      const fromBody = req.body?.branchId;
      const fromQuery = req.query?.branchId as string;
      const candidate = fromParam || fromBody || fromQuery;
      if (candidate) {
        targetBranchId = Number(candidate);
      }
    }

    if (!targetBranchId || isNaN(targetBranchId)) {
      throw new ForbiddenError('No se pudo determinar la sucursal de destino');
    }

    if (req.user.branchId !== targetBranchId) {
      throw new ForbiddenError('No tenés autorización para acceder a los datos de otra sucursal');
    }

    next();
  };
}
