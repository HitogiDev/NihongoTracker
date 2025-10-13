import { Request, Response, NextFunction } from 'express';
import { customError } from './errorMiddleware.js';
import csvtojson from 'csvtojson';
import { TMWLog, ManabeTSVLog } from '../types.js';

export async function csvToArray(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    if (!req.file) {
      throw new customError('No file uploaded', 400);
    }
    if (!['tmw', 'manabe'].includes(req.body.csvType)) {
      throw new customError('CSV type is invalid', 400);
    }
    if (req.file.size > 5 * 1024 * 1024) {
      throw new customError('File size exceeds the 5MB limit', 400);
    }

    const csvString = req.file.buffer.toString('utf8');
    const csvType = req.body.csvType;

    if (csvType === 'tmw') {
      // Parse TMW CSV format
      const results: TMWLog[] = await csvtojson({
        delimiter: ',',
      }).fromString(csvString);

      if (results.length === 0) {
        throw new customError('No data found in the CSV file', 400);
      }
      req.body.logs = results;
    } else if (csvType === 'manabe') {
      // Parse Manabe TSV format
      const results: ManabeTSVLog[] = await csvtojson({
        delimiter: '\t',
      }).fromString(csvString);

      if (results.length === 0) {
        throw new customError('No data found in the TSV file', 400);
      }
      req.body.logs = results;
    }

    return next();
  } catch (error) {
    return next(error as customError);
  }
}
