import { Router } from 'express';

import { protect } from '../middlewares/authMiddleware.js';
import { rateLimitPerUser } from '../middlewares/rateLimit.js';
import {
  getLicenses,
  getStatus,
  lookupTerm,
} from '../controllers/dictionary.controller.js';

const router = Router();

/**
 * Every route is behind `protect`, and lookups are budgeted per user.
 *
 * A public dictionary endpoint is a scraper's afternoon: the whole of Jitendex
 * is 435,448 entries, and an unauthenticated lookup would hand it over a term
 * at a time. The budget is generous for a reader — a hover is debounced to
 * ~60 ms, so even continuous hovering stays well under it — and useless for
 * bulk extraction.
 */
const lookupLimit = rateLimitPerUser({
  name: 'dictionary-lookup',
  limit: Number(process.env.DICTIONARY_RATE_LIMIT ?? 240),
  windowMs: 60_000,
});

router.get('/status', protect, getStatus);
router.get('/licenses', protect, getLicenses);
router.post('/lookup', protect, lookupLimit, lookupTerm);

export default router;
