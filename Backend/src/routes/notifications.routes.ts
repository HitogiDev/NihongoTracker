import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import {
  getNotificationSummary,
  getNotificationList,
  markNotificationsAsRead,
  markNotificationsAsUnread,
  deleteNotification,
} from '../controllers/notifications.controller.js';

const router = Router();

router.get('/summary', protect, getNotificationSummary);
router.get('/list', protect, getNotificationList);
router.patch('/read', protect, markNotificationsAsRead);
router.patch('/unread', protect, markNotificationsAsUnread);
router.delete('/:id', protect, deleteNotification);

export default router;
