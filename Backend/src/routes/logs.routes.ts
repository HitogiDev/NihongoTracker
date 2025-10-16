import { ParamsDictionary } from 'express-serve-static-core';
import { ICreateLog } from '../types.js';
import { Router } from 'express';
import {
  getLog,
  createLog,
  deleteLog,
  updateLog,
  importLogs,
  assignMedia,
  getUntrackedLogs,
  getLogScreenStats,
  getUserMediaStats,
  getGlobalMediaStats,
  getRecentMediaLogs,
} from '../controllers/logs.controller.js';
import { calculateXp } from '../middlewares/calculateXp.js';
import { protect } from '../middlewares/authMiddleware.js';
import { csvToArray } from '../middlewares/csvToArray.js';
import multer from 'multer';
import {
  getLogsFromAPI,
  getLogsFromCSV,
  importManabeLog,
} from '../middlewares/getLogs.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
});

router.post('/import', protect, getLogsFromAPI, calculateXp, importLogs);

router.post(
  '/logimport',
  protect,
  upload.single('logImport'),
  csvToArray,
  getLogsFromCSV,
  calculateXp,
  importLogs
);

router.put('/assign-media', protect, assignMedia);

router.post<ParamsDictionary, any, ICreateLog>(
  '/',
  protect,
  calculateXp,
  createLog
);

router.get('/untrackedlogs', protect, getUntrackedLogs);

router.get('/stats/logscreen', protect, getLogScreenStats);

// User-scoped media stats (uses user timezone)
router.get('/stats/media', protect, getUserMediaStats);

router.get('/stats/media/global', getGlobalMediaStats);

router.get('/media/recent', getRecentMediaLogs);

router.post('/manabe-webhook', importManabeLog, calculateXp, importLogs);

router.get('/:id', getLog);

router.delete('/:id', protect, deleteLog);

router.patch('/:id', protect, calculateXp, updateLog);

export default router;
