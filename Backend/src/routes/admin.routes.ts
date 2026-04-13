import { Router } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ILog, userRoles } from '../types.js';
import {
  updateUserById,
  deleteUserById,
  getAdminStats,
  getAdminUsers,
  searchAdminLogs,
  resetUserPassword,
  getPatronStats,
  adminSetPatreonStatus,
  syncPatreonMembers,
  getUserModerationByUsername,
  updateUserModerationByUsername,
  recalculateUserStreakByUsername,
  triggerIgdbDumpSync,
  getIgdbDumpSyncStatus,
} from '../controllers/admin.controller.js';
import {
  adminDeleteLog,
  recalculateStreaks,
  recalculateXp,
  adminUpdateLog,
} from '../controllers/logs.controller.js';
import { protect } from '../middlewares/authMiddleware.js';
import { checkPermission } from '../middlewares/checkPermission.js';
import { calculateXp } from '../middlewares/calculateXp.js';
import {
  deleteMeiliSearchIndex,
  getMeiliSearchIndexes,
  updateMeiliSearchIndexSettings,
  syncMeiliSearchIndexes,
} from '../controllers/meilisearch.controller.js';

const router = Router();

// Admin dashboard routes
router.get('/stats', protect, checkPermission(userRoles.admin), getAdminStats);
router.get(
  '/stats/patrons',
  protect,
  checkPermission(userRoles.admin),
  getPatronStats
);

router.get('/users', protect, checkPermission(userRoles.admin), getAdminUsers);

// Log routes
router.delete(
  '/logs/:id',
  protect,
  checkPermission(userRoles.admin),
  adminDeleteLog
);
router.put<ParamsDictionary, any, ILog>(
  '/logs/:id',
  protect,
  checkPermission(userRoles.admin),
  calculateXp,
  adminUpdateLog
);

router.get('/logs', protect, checkPermission(userRoles.admin), searchAdminLogs);

// User routes
router.put(
  '/users/:id',
  protect,
  checkPermission(userRoles.admin),
  updateUserById
);
router.delete(
  '/users/:id',
  protect,
  checkPermission(userRoles.admin),
  deleteUserById
);
router.post(
  '/users/:id/reset-password',
  protect,
  checkPermission(userRoles.admin),
  resetUserPassword
);
router.post(
  '/users/:id/patreon',
  protect,
  checkPermission(userRoles.admin),
  adminSetPatreonStatus
);
router.get(
  '/users/username/:username/moderation',
  protect,
  checkPermission(userRoles.admin),
  getUserModerationByUsername
);
router.patch(
  '/users/username/:username/moderation',
  protect,
  checkPermission(userRoles.admin),
  updateUserModerationByUsername
);
router.post(
  '/users/username/:username/recalculate-streaks',
  protect,
  checkPermission(userRoles.admin),
  recalculateUserStreakByUsername
);
router.post(
  '/patreon/sync',
  protect,
  checkPermission(userRoles.admin),
  syncPatreonMembers
);

router.get(
  '/recalculateStreaks',
  protect,
  checkPermission(userRoles.admin),
  recalculateStreaks
);

router.get(
  '/recalculateStats',
  protect,
  checkPermission(userRoles.admin),
  recalculateXp
);

// Meilisearch routes

router.get(
  '/meilisearch/indexes',
  protect,
  checkPermission(userRoles.admin),
  getMeiliSearchIndexes
);

router.delete(
  '/meilisearch/indexes/:indexName',
  protect,
  checkPermission(userRoles.admin),
  deleteMeiliSearchIndex
);

router.patch(
  '/meilisearch/indexes/:indexName/settings',
  protect,
  checkPermission(userRoles.admin),
  updateMeiliSearchIndexSettings
);

router.post(
  '/meilisearch/sync',
  protect,
  checkPermission(userRoles.admin),
  syncMeiliSearchIndexes
);

router.post(
  '/igdb-dump/sync',
  protect,
  checkPermission(userRoles.admin),
  triggerIgdbDumpSync
);

router.get(
  '/igdb-dump/status',
  protect,
  checkPermission(userRoles.admin),
  getIgdbDumpSyncStatus
);

export default router;
