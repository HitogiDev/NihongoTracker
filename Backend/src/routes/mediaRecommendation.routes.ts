import { Router } from 'express';
import {
  getRecommendations,
  recommendMedia,
  updateRecommendationStatus,
} from '../controllers/mediaSocial.controller.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);
router.get('/', getRecommendations);
router.post('/', recommendMedia);
router.patch('/:recommendationId/status', updateRecommendationStatus);

export default router;
