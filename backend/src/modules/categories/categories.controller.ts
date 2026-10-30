import { Request, Response, NextFunction } from 'express';
import { CategoriesService } from './categories.service';

export class CategoriesController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const includeInactive = req.user?.role === 'ADMIN' && req.query.includeInactive === 'true';
      const data = await CategoriesService.listCategories(includeInactive);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await CategoriesService.createCategory(req.body);
      res.status(201).json({ category });
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await CategoriesService.updateCategory(Number(req.params.id), req.body);
      res.status(200).json({ category });
    } catch (err) {
      next(err);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await CategoriesService.deleteCategory(Number(req.params.id));
      res.status(200).json({ message: 'Categoría desactivada correctamente' });
    } catch (err) {
      next(err);
    }
  }
}
