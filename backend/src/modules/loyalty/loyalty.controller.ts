import { Request, Response, NextFunction } from 'express';
import { LoyaltyService } from './loyalty.service';

export class LoyaltyController {
  public static async getMyPoints(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customerId = req.user!.sub;
      const data = await LoyaltyService.getBalance(customerId);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }
}
