import { Router } from 'express';
import { apiError } from '../i18n/errorCodes.js';
import multer from 'multer';
import { protect } from '../middlewares/authMiddleware.js';
import uploadFile from '../services/uploadFile.js';
import { Request, Response, NextFunction } from 'express';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB limit
  },
});

// Generic upload endpoint for avatar
router.post(
  '/',
  protect,
  upload.single('avatar'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw apiError('upload.noFile', 400, 'No file provided');
      }

      const result = await uploadFile(req.file);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Upload endpoint for banner
router.post(
  '/banner',
  protect,
  upload.single('banner'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw apiError('upload.noFile', 400, 'No file provided');
      }

      const result = await uploadFile(req.file);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
