import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import {
  comparePeriods,
  getInsights,
  updateDigestSettings,
} from '../controllers/insights.controller.js';

const router = Router();

router.use(protect);
router.get('/', getInsights);
router.get('/compare', comparePeriods);
router.put('/digest', updateDigestSettings);

export default router;
