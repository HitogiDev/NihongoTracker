import { Router } from 'express';
import {
  getRanking,
  getMediumRanking,
  getUser,
  updateUser,
  getUsers,
  clearUserData,
  getImmersionList,
} from '../controllers/users.controller.js';
import {
  getDashboardHours,
  getRecentLogs,
  getUserLogs,
  getUserStats,
} from '../controllers/logs.controller.js';
import { protect } from '../middlewares/authMiddleware.js';
import multer from 'multer';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
});

router.get('/', getUsers);

router.get('/ranking', getRanking);
router.get('/ranking/media', getMediumRanking);

router.get('/:username', getUser);

router.get('/:username/logs', getUserLogs);

router.get('/:username/stats', getUserStats);

router.get('/:username/dashboard', protect, getDashboardHours);

router.get('/:username/recentlogs', protect, getRecentLogs);

router.get('/:username/immersionlist', getImmersionList);

router.put(
  '/',
  protect,
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
  ]),
  updateUser
);

router.post('/cleardata', protect, clearUserData);

export default router;
