import { Router } from 'express';
import {
  login,
  register,
  logout,
  verifyToken,
} from '../controllers/auth.controller.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/register', register);

router.post('/login', login);

router.post('/logout', logout);

router.get('/verify', protect, verifyToken);

export default router;
