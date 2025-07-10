import { ParamsDictionary } from 'express-serve-static-core';
import { ICreateLog } from '../types.js';
import { Router } from 'express';
import {
  getLog,
  getLogDetails,
  createLog,
  deleteLog,
  updateLog,
  importLogs,
  assignMedia,
  getUntrackedLogs,
} from '../controllers/logs.controller.js';
import { calculateXp } from '../middlewares/calculateXp.js';
import { protect } from '../libs/authMiddleware.js';
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
  '/importfromcsv',
  protect,
  upload.single('csv'),
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

router.post('/manabe-webhook', importManabeLog, calculateXp, importLogs);

router.get('/:id', getLog); // Make this route public for sharing functionality

router.get('/:id/details', getLogDetails); // New route for detailed log information

router.delete('/:id', protect, deleteLog);

router.patch('/:id', protect, calculateXp, updateLog);

export default router;
