import { Request, Response, NextFunction } from 'express';
import { AuditService } from './audit.service';

export class AuditController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      const action = req.query.action as string | undefined;

      const result = await AuditService.listLogs({ page, limit, branchId, action });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
