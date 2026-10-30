import { Request, Response, NextFunction } from 'express';
import { ReportsService } from './reports.service';

export class ReportsController {
  public static async getSales(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ReportsService.getSalesReport(req.user!, req.query as any);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public static async getTopProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ReportsService.getTopProductsReport(req.user!, req.query as any);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}
