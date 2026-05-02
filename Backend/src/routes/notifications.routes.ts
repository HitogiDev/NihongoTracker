import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { getNotificationSummary } from '../controllers/notifications.controller.js';

const router = Router();

router.get('/summary', protect, getNotificationSummary);

export default router;
