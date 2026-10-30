import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service';

export class UsersController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await UsersService.listUsers(req.user!, req.query as any);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await UsersService.getUserById(req.user!, Number(req.params.id));
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await UsersService.createUser(req.user!, req.body);
      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await UsersService.updateUser(req.user!, Number(req.params.id), req.body);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  }

  public static async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await UsersService.deactivateUser(req.user!, Number(req.params.id));
      res.status(200).json({ message: 'Usuario desactivado correctamente' });
    } catch (err) {
      next(err);
    }
  }

  public static async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await UsersService.updateMe(req.user!.sub, req.body);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  }
}
