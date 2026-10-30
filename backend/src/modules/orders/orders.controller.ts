import { Request, Response, NextFunction } from 'express';
import { OrdersService } from './orders.service';

export class OrdersController {
  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await OrdersService.createOrder(req.user!, req.body);
      res.status(201).json({ order });
    } catch (err) {
      next(err);
    }
  }

  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await OrdersService.listOrders(req.user!, req.query as any);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await OrdersService.getOrderById(req.user!, Number(req.params.id));
      res.status(200).json({ order });
    } catch (err) {
      next(err);
    }
  }

  public static async pay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await OrdersService.payOrder(
        req.user!,
        Number(req.params.id),
        req.body.paymentMethod
      );
      res.status(200).json({ order });
    } catch (err) {
      next(err);
    }
  }

  public static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await OrdersService.updateOrderStatus(
        req.user!,
        Number(req.params.id),
        req.body.status,
        req.body.cancelReason
      );
      res.status(200).json({ order });
    } catch (err) {
      next(err);
    }
  }

  public static async overrideCancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = Number(req.params.id);
      const { managerPin, reason } = req.body;
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const result = await OrdersService.overrideCancelOrder(
        req.user!,
        orderId,
        managerPin,
        reason,
        ip
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public static async getKds(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branchIdOverride = req.query.branchId ? Number(req.query.branchId) : undefined;
      const data = await OrdersService.getKdsOrders(req.user!, branchIdOverride);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  public static async submitTransferProof(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = Number(req.params.id);
      const data = await OrdersService.submitTransferProof(req.user!, orderId, req.body);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  public static async verifyTransferProof(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = Number(req.params.id);
      const data = await OrdersService.verifyTransferProof(req.user!, orderId, req.body);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  public static async listPendingTransfers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branchIdOverride = req.body?.branchId ? Number(req.body.branchId) : undefined;
      const data = await OrdersService.listPendingTransfers(req.user!, branchIdOverride);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }
}
