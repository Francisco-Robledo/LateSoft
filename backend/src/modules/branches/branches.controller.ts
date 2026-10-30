import { Request, Response, NextFunction } from 'express';
import { BranchesService } from './branches.service';

export class BranchesController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const includeInactive = req.user?.role === 'ADMIN' && req.query.activeOnly === 'false';
      const data = await BranchesService.listBranches(includeInactive);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  public static async getByIdOrSlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await BranchesService.getBranchByIdOrSlug(req.params.id);
      res.status(200).json({ branch });
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await BranchesService.createBranch(req.body);
      res.status(201).json({ branch });
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await BranchesService.updateBranch(Number(req.params.id), req.body);
      res.status(200).json({ branch });
    } catch (err) {
      next(err);
    }
  }

  public static async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await BranchesService.deactivateBranch(Number(req.params.id));
      res.status(200).json({ message: 'Sucursal desactivada correctamente' });
    } catch (err) {
      next(err);
    }
  }

  public static async getMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await BranchesService.getBranchMenu(Number(req.params.id));
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public static async addProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branchId = Number(req.params.id);
      const productId = Number(req.params.productId);
      const branchProduct = await BranchesService.addProductToBranch(
        req.user!,
        branchId,
        productId,
        req.body.price,
        req.body.isAvailable
      );
      res.status(201).json({ branchProduct });
    } catch (err) {
      next(err);
    }
  }

  public static async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branchId = Number(req.params.id);
      const productId = Number(req.params.productId);
      const branchProduct = await BranchesService.updateBranchProduct(
        req.user!,
        branchId,
        productId,
        req.body
      );
      res.status(200).json({ branchProduct });
    } catch (err) {
      next(err);
    }
  }

  public static async removeProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branchId = Number(req.params.id);
      const productId = Number(req.params.productId);
      await BranchesService.removeProductFromBranch(req.user!, branchId, productId);
      res.status(200).json({ message: 'Producto retirado de la sucursal' });
    } catch (err) {
      next(err);
    }
  }

  public static async toggleAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branchId = Number(req.params.id);
      const productId = Number(req.params.productId);
      const branchProduct = await BranchesService.toggleProductAvailability(
        req.user!,
        branchId,
        productId,
        req.body.isAvailable,
        req.body.pausedReason
      );
      res.status(200).json({ branchProduct });
    } catch (err) {
      next(err);
    }
  }
}
