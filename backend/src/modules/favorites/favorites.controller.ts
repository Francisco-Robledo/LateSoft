import { Request, Response, NextFunction } from 'express';
import { FavoritesService } from './favorites.service';

export class FavoritesController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await FavoritesService.listFavorites(req.user!.sub);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  public static async add(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await FavoritesService.addFavorite(req.user!.sub, req.body.branchId);
      res.status(201).json({ message: 'Sucursal agregada a favoritas' });
    } catch (err) {
      next(err);
    }
  }

  public static async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await FavoritesService.removeFavorite(req.user!.sub, Number(req.params.branchId));
      res.status(200).json({ message: 'Sucursal eliminada de favoritas' });
    } catch (err) {
      next(err);
    }
  }
}
