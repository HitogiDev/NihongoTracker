import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { checkPermission } from '../middlewares/checkPermission.js';
import { userRoles } from '../types.js';
import {
  getAllAchievements,
  getPublicAchievements,
  getUserAchievements,
  getMyAchievements,
  checkUserAchievements,
  getAchievementProgressById,
  createAchievement,
  updateAchievement,
  deleteAchievement,
  getUserAchievementStats,
} from '../controllers/achievement.controller.js';

const router = Router();

// Public routes
router.get('/public', getPublicAchievements);

// Protected routes (require authentication)
router.use(protect);

// User's own achievements
router.get('/me', getMyAchievements);
router.post('/check', checkUserAchievements);
router.get('/:achievementId/progress', getAchievementProgressById);

// View other user's achievements
router.get('/user/:userId', getUserAchievements);
router.get('/stats/:userId', getUserAchievementStats);

// Admin routes
router.get('/all', checkPermission(userRoles.admin), getAllAchievements);
router.post('/', checkPermission(userRoles.admin), createAchievement);
router.patch('/:id', checkPermission(userRoles.admin), updateAchievement);
router.delete('/:id', checkPermission(userRoles.admin), deleteAchievement);

export default router;
