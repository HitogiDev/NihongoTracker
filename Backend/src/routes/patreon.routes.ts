import { Router } from 'express';
import {
  linkPatreonAccount,
  unlinkPatreonAccount,
  handlePatreonWebhook,
  getPatreonStatus,
  updateCustomBadgeText,
  updateBadgeColors,
  initiatePatreonOAuth,
  handlePatreonOAuthCallback,
} from '../controllers/patreon.controller.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// User routes (protected)
router.get('/status', protect, getPatreonStatus);
router.post('/link', protect, linkPatreonAccount);
router.post('/unlink', protect, unlinkPatreonAccount);
router.patch('/badge', protect, updateCustomBadgeText);
router.patch('/badge-colors', protect, updateBadgeColors);

// OAuth2 routes
router.get('/oauth/init', protect, initiatePatreonOAuth);
router.get('/oauth/callback', handlePatreonOAuthCallback);
router.get('/campaign-members');

// Webhook route (public, but verified by signature)
router.post('/webhook', handlePatreonWebhook);

export default router;
