import { Router } from 'express';
import { compareUserStats } from '../controllers/comparison.controller.js';

const router = Router();

// Compare stats between two users for a specific media
router.get('/users', compareUserStats);

export default router;
