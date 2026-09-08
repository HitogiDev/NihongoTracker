import { Router } from 'express';
import {
  createLongTermGoal,
  deleteLongTermGoal,
  getLongTermGoals,
  updateLongTermGoal,
} from '../controllers/longTermGoals.controller.js';
import {
  createDailyGoal,
  deleteDailyGoal,
  getDailyGoals,
  updateDailyGoal,
} from '../controllers/dailyGoals.controller.js';
import { protect } from '../middlewares/authMiddleware.js';
import {
  createImmersionForecast,
  deleteImmersionForecast,
  getImmersionForecasts,
  updateImmersionForecast,
} from '../controllers/immersionForecast.controller.js';

const router = Router();

router.use(protect);

router.get('/forecasts', getImmersionForecasts);
router.post('/forecasts', createImmersionForecast);
router.patch('/forecasts/:forecastId', updateImmersionForecast);
router.delete('/forecasts/:forecastId', deleteImmersionForecast);

// Long-term goals routes
router.get('/long-term/:username', getLongTermGoals);
router.post('/long-term', createLongTermGoal);
router.patch('/long-term/:goalId', updateLongTermGoal);
router.delete('/long-term/:goalId', deleteLongTermGoal);

// Daily goals routes
router.get('/daily/:username', getDailyGoals);
router.post('/daily', createDailyGoal);
router.patch('/daily/:goalId', updateDailyGoal);
router.delete('/daily/:goalId', deleteDailyGoal);

export default router;
