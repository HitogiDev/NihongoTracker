import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import {
  getUserTags,
  createTag,
  updateTag,
  deleteTag,
} from '../controllers/tag.controller.js';

const router = Router();

router.route('/').get(protect, getUserTags).post(protect, createTag);

router.route('/:id').patch(protect, updateTag).delete(protect, deleteTag);

export default router;
