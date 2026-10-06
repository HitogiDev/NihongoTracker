import { Router } from 'express';
import { requestRateLimit } from '../middlewares/requestRateLimit.js';
import {
  login,
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
  protect,
  requireSessionAuth,
} from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/register', register);

router.post('/login', login);

router.post('/logout', logout);

router.get('/verify', requireSessionAuth, protect, verifyToken);

router.post('/verify-email', requestRateLimit(20, 600_000), verifyEmail);

router.post('/resend-verification', protect, resendVerificationEmail);

router.post('/forgot-password', requestRateLimit(5, 600_000), forgotPassword);

router.post('/reset-password/:token', requestRateLimit(20, 600_000), resetPassword);

router.get('/stats', getPublicStats);

export default router;
