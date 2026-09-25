import { Router } from 'express';
import {
  backfillAnilist,
  getAnilistStatus,
  getAnilistSyncedLogs,
  handleAnilistOAuthCallback,
  initiateAnilistOAuth,
  syncAnilistNow,
  unlinkAnilistAccount,
  updateAnilistSettings,
} from '../controllers/anilist.controller.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/status', protect, getAnilistStatus);
router.get('/logs', protect, getAnilistSyncedLogs);
router.patch('/settings', protect, updateAnilistSettings);
router.post('/unlink', protect, unlinkAnilistAccount);
router.post('/sync', protect, syncAnilistNow);
router.post('/backfill', protect, backfillAnilist);

// OAuth2: the callback is hit by AniList's redirect, so it carries no session
// of its own — the one-shot state issued by /oauth/init identifies the user.
router.get('/oauth/init', protect, initiateAnilistOAuth);
router.get('/oauth/callback', handleAnilistOAuthCallback);

export default router;
