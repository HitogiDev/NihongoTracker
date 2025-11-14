import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import {
  getUserTagsByUsername,
  createTag,
  updateTag,
  deleteTag,
} from '../controllers/tag.controller.js';

const router = Router();

router.route('/').post(protect, createTag);

router.route('/user/:username').get(getUserTagsByUsername);

router.route('/:id').patch(protect, updateTag).delete(protect, deleteTag);

export default router;
