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
export default router;
