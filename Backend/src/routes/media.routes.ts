import { Router } from 'express';
import {
  getMedia,
  searchMedia,
  multiSearchMedia,
  getAverageColor,
  addMediaReview,
  getMediaReviews,
  editMediaReview,
  deleteMediaReview,
  toggleMediaReviewLike,
  getMediaReviewById,
  anilistSearchProxy,
} from '../controllers/media.controller.js';
import { protect } from '../middlewares/authMiddleware.js';

import { searchYouTubeVideo } from '../services/searchYoutube.js';

const router = Router();

router.get('/utils/avgcolor', getAverageColor);
router.get('/anilist/search', anilistSearchProxy);
router.get('/search', searchMedia);
router.get('/multi-search', multiSearchMedia);
router.get('/youtube/video', searchYouTubeVideo);
router.get('/reviews/:reviewId', getMediaReviewById);
router.get('/:mediaType/:contentId/reviews', getMediaReviews);
router.post('/:mediaType/:contentId/reviews', protect, addMediaReview);
router.put(
  '/:mediaType/:contentId/reviews/:reviewId',
  protect,
  editMediaReview
);
router.delete(
  '/:mediaType/:contentId/reviews/:reviewId',
  protect,
  deleteMediaReview
);
router.post(
  '/:mediaType/:contentId/reviews/:reviewId/like',
  protect,
  toggleMediaReviewLike
);
router.get('/:mediaType/:contentId', getMedia);

export default router;
