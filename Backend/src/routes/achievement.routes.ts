import { Router } from 'express';
import { protect, optionalProtect } from '../middlewares/authMiddleware.js';
import {
  getAchievements,
  getMyAchievements,
  getUserAchievementsByUsername,
  getPendingAchievements,
  getShowcase,
  updateShowcase,
  getAchievementFeed,
  adminGetAchievements,
  adminCreateAchievement,
  adminUpdateAchievement,
  adminDeleteAchievement,
  adminGrantAchievement,
  adminRevokeAchievement,
} from '../controllers/achievement.controller.js';
import { checkPermission } from '../middlewares/checkPermission.js';
import { userRoles } from '../types.js';

const router = Router();

// ─── Public ───────────────────────────────────────────────────────────────────
router.get('/', optionalProtect, getAchievements);
router.get('/feed', getAchievementFeed);
router.get('/user/:username', getUserAchievementsByUsername);

// ─── Authenticated user ───────────────────────────────────────────────────────
router.get('/me', protect, getMyAchievements);
router.get('/me/pending', protect, getPendingAchievements);
router.get('/me/showcase', protect, getShowcase);
router.put('/me/showcase', protect, updateShowcase);

// ─── Admin ────────────────────────────────────────────────────────────────────
router.get(
  '/admin',
  protect,
  checkPermission(userRoles.admin),
  adminGetAchievements
);
router.post(
  '/admin',
  protect,
  checkPermission(userRoles.admin),
  adminCreateAchievement
);
router.put(
  '/admin/:id',
  protect,
  checkPermission(userRoles.admin),
  adminUpdateAchievement
);
router.delete(
  '/admin/:id',
  protect,
  checkPermission(userRoles.admin),
  adminDeleteAchievement
);
router.post(
  '/admin/grant',
  protect,
  checkPermission(userRoles.admin),
  adminGrantAchievement
);
router.post(
  '/admin/revoke',
  protect,
  checkPermission(userRoles.admin),
  adminRevokeAchievement
);

export default router;
