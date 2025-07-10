import { Router } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ILog, userRoles } from '../types.js';
import {
  updateUserById,
  deleteUserById,
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

export default router;
