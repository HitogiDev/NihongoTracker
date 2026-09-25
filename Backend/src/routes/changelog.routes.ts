import express from 'express';
import {
  getChangelogs,
  getAllChangelogs,
  getChangelog,
  createChangelog,
  updateChangelog,
  deleteChangelog,
} from '../controllers/changelog.controller.js';
import { protect } from '../middlewares/authMiddleware.js';
import { checkPermission } from '../middlewares/checkPermission.js';
import { userRoles } from '../types.js';

const router = express.Router();

// Public routes
router.get('/', getChangelogs); // Get published changelogs only
router.get('/:id', getChangelog); // Get single changelog

// Admin routes
router.get(
  '/admin/all',
  protect,
  checkPermission(userRoles.admin),
  getAllChangelogs
); // Get all including drafts
router.post('/', protect, checkPermission(userRoles.admin), createChangelog);
router.patch(
  '/:id',
  protect,
  checkPermission(userRoles.admin),
  updateChangelog
);
router.delete(
  '/:id',
  protect,
  checkPermission(userRoles.admin),
  deleteChangelog
);

export default router;
