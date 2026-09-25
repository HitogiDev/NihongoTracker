import { Router } from 'express';
import { userRoles } from '../types.js';
import { protect } from '../middlewares/authMiddleware.js';
import { checkAnyPermission } from '../middlewares/checkPermission.js';
import {
  createMediaRequest,
  getMyMediaRequests,
  getMediaRequests,
  reviewMediaRequest,
} from '../controllers/mediaRequest.controller.js';

const router = Router();

// User-facing
router.post('/', protect, createMediaRequest);
router.get('/mine', protect, getMyMediaRequests);

// Admin/mod review queue
router.get(
  '/',
  protect,
  checkAnyPermission(userRoles.admin, userRoles.mod),
  getMediaRequests
);
router.patch(
  '/:id/review',
  protect,
  checkAnyPermission(userRoles.admin, userRoles.mod),
  reviewMediaRequest
);

export default router;
