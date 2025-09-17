import { Router } from 'express';
import {
  createLongTermGoal,
  deleteLongTermGoal,
  getLongTermGoals,
  updateLongTermGoal,
} from '../controllers/longTermGoals.controller.js';
import { protect } from '../libs/authMiddleware.js';

const router = Router();

router.use(protect);

router.get('/long-term/:username', getLongTermGoals);
router.post('/long-term', createLongTermGoal);
router.patch('/long-term/:goalId', updateLongTermGoal);
router.delete('/long-term/:goalId', deleteLongTermGoal);

export default router;
