import { Request, Response, NextFunction } from 'express';
import { ShiftsService } from './shifts.service';

export class ShiftsController {
  public static async getCurrent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branchIdOverride = req.query.branchId ? Number(req.query.branchId) : undefined;
      const data = await ShiftsService.getCurrentShift(req.user!, branchIdOverride);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  public static async open(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const shift = await ShiftsService.openShift(req.user!, req.body, ip);
      res.status(201).json({ shift });
    } catch (err) {
      next(err);
    }
  }

  public static async close(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const shiftId = Number(req.params.id);
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const result = await ShiftsService.closeShift(req.user!, shiftId, req.body, ip);
      res.status(200).json({ result });
    } catch (err) {
      next(err);
    }
  }
}
