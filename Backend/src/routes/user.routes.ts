import { Router } from 'express';
import {
  getRanking,
  getMediumRanking,
  getUser,
  updateUser,
  searchUsers,
  clearUserData,
  getImmersionList,
  compareUserStats,
  getRankingSummary,
  getRankingHistory,
  updateMediaCompletionStatus,
  removeMediaFromImmersionList,
  updateHiddenRecentMedia,
  getHiddenRecentMedia,
  updateStatsLayout,
  updateProfileLayout,
  updateSocialPrivacy,
  updateFavorites,
  getGanttData,
  getCustomizationOptions,
  updateCustomization,
} from '../controllers/users.controller.js';
import { exportLogsCSV } from '../controllers/export.controller.js';
import {
  getDashboardHours,
  getRecentLogs,
  getUserLogs,
  getUserStats,
} from '../controllers/logs.controller.js';
import { protect, optionalProtect } from '../middlewares/authMiddleware.js';
import multer from 'multer';
import {
  followProfile,
  getFollowers,
  getFollowing,
  getRelationship,
  unfollowProfile,
} from '../controllers/follow.controller.js';
import { socialRateLimit } from '../middlewares/socialRateLimit.js';
import { getCurrentUser } from '../controllers/currentUser.controller.js';

const router = Router();
const followRateLimit = socialRateLimit({
  action: 'follow',
  max: 60,
  windowMs: 60_000,
});
const MAX_USER_MEDIA_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_USER_MEDIA_FILE_SIZE_BYTES,
  },
});

router.get('/search', searchUsers);

// Registered before `/:username` so "me" is never treated as a username.
router.get('/me', protect, getCurrentUser);
router.get('/me/customization', protect, getCustomizationOptions);
router.patch('/me/customization', protect, updateCustomization);

router.get('/compare', optionalProtect, compareUserStats);

router.get('/:username/followers', optionalProtect, getFollowers);
router.get('/:username/following', optionalProtect, getFollowing);
router.get('/:username/relationship', protect, getRelationship);
router.post('/:username/follow', protect, followRateLimit, followProfile);
router.delete('/:username/follow', protect, followRateLimit, unfollowProfile);

router.get('/ranking', getRanking);
router.get('/ranking/media', getMediumRanking);
router.get('/:username/ranking-summary', optionalProtect, getRankingSummary);
router.get('/:username/ranking-history', optionalProtect, getRankingHistory);

router.get('/:username', optionalProtect, getUser);

router.post('/media/status', protect, updateMediaCompletionStatus);

router.delete('/media/:type/:mediaId', protect, removeMediaFromImmersionList);

router.get('/:username/logs', optionalProtect, getUserLogs);

router.get('/:username/stats', optionalProtect, getUserStats);

router.get('/:username/dashboard', protect, getDashboardHours);

router.get('/:username/recentlogs', protect, getRecentLogs);

router.get('/:username/immersionlist', optionalProtect, getImmersionList);

router.get('/:username/gantt', optionalProtect, getGanttData);

router.put(
  '/',
  protect,
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
  ]),
  updateUser
);

router.patch('/settings/hidden-media', protect, updateHiddenRecentMedia);
router.get('/settings/hidden-media', protect, getHiddenRecentMedia);
router.patch('/settings/stats-layout', protect, updateStatsLayout);
router.patch('/settings/profile-layout', protect, updateProfileLayout);
router.patch('/settings/social-privacy', protect, updateSocialPrivacy);
router.patch('/favorites', protect, updateFavorites);

router.post('/cleardata', protect, clearUserData);

router.get('/export/csv', protect, exportLogsCSV);

export default router;
