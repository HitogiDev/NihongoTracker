import { Router } from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { socialRateLimit } from '../middlewares/socialRateLimit.js';
import {
  acceptDuelHandler,
  cancelDuelHandler,
  createDuelHandler,
  declineDuelHandler,
  getDuel,
  getDuelCounts,
  getDuelStatsHandler,
  getHeadToHeadHandler,
  listDuels,
  rematchDuelHandler,
} from '../controllers/duels.controller.js';

const router = Router();
const createRateLimit = socialRateLimit({
  action: 'duel-create',
  max: 20,
  windowMs: 60 * 60_000,
});

router.use(protect);
router.get('/', listDuels);
router.get('/counts', getDuelCounts);
router.get('/h2h/:username', getHeadToHeadHandler);
router.get('/stats/:username', getDuelStatsHandler);
router.post('/', createRateLimit, createDuelHandler);
router.get('/:duelId', getDuel);
router.post('/:duelId/accept', acceptDuelHandler);
router.post('/:duelId/decline', declineDuelHandler);
router.post('/:duelId/cancel', cancelDuelHandler);
router.post('/:duelId/rematch', createRateLimit, rematchDuelHandler);

export default router;
