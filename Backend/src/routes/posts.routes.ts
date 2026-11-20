import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import {
  createPostHandler,
  deletePostHandler,
  getPostImage,
  requirePostsEnabled,
  updatePostHandler,
} from '../controllers/posts.controller.js';
import { apiError } from '../i18n/errorCodes.js';
import { protect } from '../middlewares/authMiddleware.js';
import { requestRateLimit } from '../middlewares/requestRateLimit.js';
import { socialRateLimit } from '../middlewares/socialRateLimit.js';
import { POST_IMAGES_MAX } from '../models/post.model.js';
import { HOSTED_POST_IMAGE_MAX_BYTES } from '../services/posts.service.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: HOSTED_POST_IMAGE_MAX_BYTES, files: POST_IMAGES_MAX + 1 },
});

/** Map multer limit errors to stable post error codes. */
function postImages(req: Request, res: Response, next: NextFunction) {
  upload.fields([
    { name: 'images', maxCount: POST_IMAGES_MAX },
    { name: 'backgroundImage', maxCount: 1 },
  ])(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(
          apiError('post.imageTooLarge', 400, 'Images must be 8 MB or less', {
            max: 8,
          })
        );
      }
      return next(
        apiError(
          'post.tooManyImages',
          400,
          `A post can have at most ${POST_IMAGES_MAX} images`,
          { max: POST_IMAGES_MAX }
        )
      );
    }
    return next(error);
  });
}

const postRateLimit = socialRateLimit({
  action: 'post-write',
  max: 10,
  windowMs: 60_000,
});

/**
 * The image proxy is public because native image tags cannot send Bearer tokens.
 * The host allowlist and the rate limit restrict it.
 */
router.get('/image', requestRateLimit(600, 600_000), getPostImage);

router.use(protect, requirePostsEnabled);
router.post('/', postRateLimit, postImages, createPostHandler);
router.patch('/:postId', postRateLimit, postImages, updatePostHandler);
router.delete('/:postId', deletePostHandler);

export default router;
