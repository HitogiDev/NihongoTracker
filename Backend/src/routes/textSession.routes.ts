import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import {
  getRecentSessions,
  getSessionByContentId,
  addLinesToSession,
  removeLinesFromSession,
  clearSessionLines,
  deleteSession,
  checkRoomExists,
  updateSessionTimer,
} from '../controllers/textSession.controller.js';

const router = Router();

router.get('/recent', protect, getRecentSessions);
router.get('/room/:roomId/exists', protect, checkRoomExists);
router.get('/:contentId', protect, getSessionByContentId);
router.post('/:contentId/lines', protect, addLinesToSession);
router.patch('/:contentId/timer', protect, updateSessionTimer);
router.delete('/:contentId/lines', protect, removeLinesFromSession);
router.delete('/:contentId/lines/all', protect, clearSessionLines);
router.delete('/:contentId', protect, deleteSession);

export default router;
