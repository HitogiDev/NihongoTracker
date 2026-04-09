import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import {
  generateApiKey,
  listApiKeys,
  deleteApiKey,
} from '../controllers/apiKey.controller.js';

const router = Router();

router.use(protect);

router.post('/', generateApiKey);
router.get('/', listApiKeys);
router.delete('/:id', deleteApiKey);

export default router;
