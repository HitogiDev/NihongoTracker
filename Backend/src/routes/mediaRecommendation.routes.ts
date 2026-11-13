import { Router } from 'express';
import {
  getRecommendations,
  recommendMedia,
  updateRecommendationStatus,
} from '../controllers/mediaSocial.controller.js';
import {
  dismissLevelRecommendation,
  getLevelRecommendationsHandler,
  restoreLevelRecommendation,
} from '../controllers/levelRecommendations.controller.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);
router.get('/', getRecommendations);
router.get('/level', getLevelRecommendationsHandler);
router.post('/level/dismissals', dismissLevelRecommendation);
router.delete('/level/dismissals/:mediaType/:mediaId', restoreLevelRecommendation);
router.post('/', recommendMedia);
router.patch('/:recommendationId/status', updateRecommendationStatus);

export default router;
