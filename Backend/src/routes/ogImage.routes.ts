import { Router, Request, Response, NextFunction } from 'express';
import User from '../models/user.model.js';
import { generateProfileOgImage } from '../services/generateOgImage.js';
import { customError } from '../middlewares/errorMiddleware.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

router.get(
  '/user/:username',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username } = req.params;

      const user = await User.findOne({ username })
        .collation({ locale: 'en', strength: 2 })
        .select('username stats avatar banner');

      if (!user) {
        return next(new customError('User not found', 404));
      }

      // Generate the OG image
      const imageBuffer = await generateProfileOgImage({ user });

      // Set cache headers (cache for 10 minutes for faster updates)
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=600');
      res.send(imageBuffer);
    } catch (error) {
      console.error('Error generating OG image:', error);
      return next(error as customError);
    }
  }
);

router.post(
  '/invalidate-og-cache',
  protect,
  async (_req: Request, res: Response) => {
    try {
      const user = res.locals.user;

      // Update the user's updatedAt field to force cache bust
      user.updatedAt = new Date();
      await user.save();

      res.json({
        success: true,
        message: 'OG image cache invalidated',
        newVersion: user.updatedAt.getTime(),
      });
    } catch (error) {
      console.error('Error invalidating cache:', error);
      res.status(500).json({ error: 'Failed to invalidate cache' });
    }
  }
);

export default router;
