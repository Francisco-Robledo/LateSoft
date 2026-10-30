import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';

export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // En arquitectura POST-only, los parámetros pueden llegar en el body.
      // Sincronizamos body en query para esquemas Zod que validan 'query'.
      const mergedQuery = { ...(req.body || {}), ...(req.query || {}) };
      const parsed = await schema.parseAsync({
        body: req.body,
        query: mergedQuery,
        params: req.params,
      });

      if (parsed.body) req.body = parsed.body;
      if (parsed.query) req.query = parsed.query;
      if (parsed.params) req.params = parsed.params;

      next();
    } catch (error) {
      next(error);
    }
  };
};
