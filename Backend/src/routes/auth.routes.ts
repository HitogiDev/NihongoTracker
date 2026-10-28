import { Router } from 'express';
import { requestRateLimit } from '../middlewares/requestRateLimit.js';
import {
  login,
  loginMobile,
  register,
  logout,
  verifyToken,
  verifyEmail,
  forgotPassword,
  resetPassword,
  resendVerificationEmail,
  getPublicStats,
} from '../controllers/auth.controller.js';
import {
  logoutMobile,
  refreshMobileSession,
  updateMobilePushToken,
} from '../controllers/mobileAuth.controller.js';
import {
  protect,
  requireSessionAuth,
  requireMobileSession,
} from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/register', register);

router.post('/login', login);

router.post('/mobile/login', requestRateLimit(10, 600_000), loginMobile);
router.post('/mobile/refresh', requestRateLimit(30, 600_000), refreshMobileSession);
router.post('/mobile/logout', protect, requireMobileSession, logoutMobile);
router.put('/mobile/push-token', protect, requireMobileSession, updateMobilePushToken);

router.post('/logout', logout);

router.get('/verify', requireSessionAuth, protect, verifyToken);

router.post('/verify-email', requestRateLimit(20, 600_000), verifyEmail);

router.post('/resend-verification', protect, resendVerificationEmail);

router.post('/forgot-password', requestRateLimit(5, 600_000), forgotPassword);

router.post('/reset-password/:token', requestRateLimit(20, 600_000), resetPassword);

router.get('/stats', getPublicStats);

export default router;
