import { Router } from 'express';
import multer from 'multer';
import { protect } from '../libs/authMiddleware.js';
import uploadFile from '../services/uploadFile.js';
import { Request, Response, NextFunction } from 'express';
import { customError } from '../middlewares/errorMiddleware.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
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
        throw new customError('No file provided', 400);
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
        throw new customError('No file provided', 400);
      }

      const result = await uploadFile(req.file);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
