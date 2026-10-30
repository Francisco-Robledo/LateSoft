import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { authenticate, authorize } from '../../middlewares/auth';
import { ValidationError } from '../../utils/errors';

const router = Router();

const uploadsDir = path.resolve(__dirname, '../../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'MANAGER'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { base64, filename, mimeType } = req.body;

      if (!base64 || typeof base64 !== 'string') {
        throw new ValidationError('Se requiere la imagen en formato base64');
      }

      // Limpiar prefijo data URI si viene incluido (ej. data:image/png;base64,...)
      const cleanedBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanedBase64, 'base64');

      // Determinar extensión
      let ext = 'jpg';
      if (mimeType) {
        if (mimeType.includes('png')) ext = 'png';
        else if (mimeType.includes('webp')) ext = 'webp';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
      } else if (filename && filename.includes('.')) {
        ext = filename.split('.').pop() || 'jpg';
      }

      const uniqueName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
      const filePath = path.join(uploadsDir, uniqueName);

      await fs.promises.writeFile(filePath, buffer);

      // Armar URL pública
      const host = req.get('host') || 'localhost:3001';
      const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      const url = `${protocol}://${host}/uploads/${uniqueName}`;

      res.status(201).json({
        url,
        filename: uniqueName,
        size: buffer.length,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
