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
} from '../controllers/admin.controller.js';
import {
  deleteLog,
  recalculateStreaks,
  recalculateXp,
  updateLog,
} from '../controllers/logs.controller.js';
import { protect } from '../libs/authMiddleware.js';
import { checkPermission } from '../middlewares/checkPermission.js';
import { calculateXp } from '../middlewares/calculateXp.js';

const router = Router();

// Admin dashboard routes
router.get('/stats', protect, checkPermission(userRoles.admin), getAdminStats);

router.get('/users', protect, checkPermission(userRoles.admin), getAdminUsers);

//Log routes
router.delete(
  '/logs/:id',
  protect,
  checkPermission(userRoles.admin),
  deleteLog
);
router.put<ParamsDictionary, any, ILog>(
  '/logs/:id',
  protect,
  checkPermission(userRoles.admin),
  calculateXp,
  updateLog
);

//User routes
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

router.get('/logs', protect, checkPermission(userRoles.admin), searchAdminLogs);

export default router;
