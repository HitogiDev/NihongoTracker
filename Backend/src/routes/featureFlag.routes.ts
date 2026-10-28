import express from 'express';
import {
  listFeatureFlags,
  updateFeatureFlag,
} from '../controllers/featureFlags.controller.js';
import { protect } from '../middlewares/authMiddleware.js';
import { checkPermission } from '../middlewares/checkPermission.js';
import { userRoles } from '../types.js';

const router = express.Router();

router.get('/', listFeatureFlags);
router.patch(
  '/:key',
  protect,
  checkPermission(userRoles.admin),
  updateFeatureFlag
);

export default router;
