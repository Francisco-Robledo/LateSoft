import { Request, Response, NextFunction } from 'express';
import { ProductsService } from './products.service';

export class ProductsController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ProductsService.listProducts(req.query as any);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await ProductsService.getProductById(Number(req.params.id));
      res.status(200).json({ product });
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await ProductsService.createProduct(req.body);
      res.status(201).json({ product });
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await ProductsService.updateProduct(Number(req.params.id), req.body);
      res.status(200).json({ product });
    } catch (err) {
      next(err);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await ProductsService.deleteProduct(Number(req.params.id));
      res.status(200).json({ message: 'Producto desactivado correctamente' });
    } catch (err) {
      next(err);
    }
  }
}
