import { Router } from 'express';
import {
  createDailyGoal,
  deleteDailyGoal,
  getDailyGoals,
  updateDailyGoal,
} from '../controllers/dailyGoals.controller.js';
import { protect } from '../libs/authMiddleware.js';

const router = Router();

router.use(protect);

router.get('/daily/:username', getDailyGoals);
router.post('/daily', createDailyGoal);
router.patch('/daily/:goalId', updateDailyGoal);
router.delete('/daily/:goalId', deleteDailyGoal);

export default router;
