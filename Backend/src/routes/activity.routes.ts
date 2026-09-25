import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { socialRateLimit } from '../middlewares/socialRateLimit.js';
import {
  addComment,
  deleteComment,
  editComment,
  getComments,
  getFeed,
  likeComment,
  reactToActivity,
  unlikeComment,
  unreactToActivity,
} from '../controllers/activity.controller.js';

const router = Router();
const reactionRateLimit = socialRateLimit({
  action: 'activity-reaction',
  max: 120,
  windowMs: 60_000,
});
const commentRateLimit = socialRateLimit({
  action: 'activity-comment',
  max: 20,
  windowMs: 60_000,
});

router.use(protect);
router.get('/', getFeed);
router.put('/:activityId/reaction', reactionRateLimit, reactToActivity);
router.delete('/:activityId/reaction', reactionRateLimit, unreactToActivity);
router.get('/:activityId/comments', getComments);
router.post('/:activityId/comments', commentRateLimit, addComment);
router.patch(
  '/:activityId/comments/:commentId',
  commentRateLimit,
  editComment
);
router.delete('/:activityId/comments/:commentId', deleteComment);
router.put(
  '/:activityId/comments/:commentId/like',
  reactionRateLimit,
  likeComment
);
router.delete(
  '/:activityId/comments/:commentId/like',
  reactionRateLimit,
  unlikeComment
);

export default router;
