import { Request, Response, NextFunction } from 'express';
import { customError } from './errorMiddleware.js';
import csvtojson from 'csvtojson';
import { TMWLog, ManabeTSVLog, VNCRLog } from '../types.js';

export async function csvToArray(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    if (!req.file) {
      throw new customError('No file uploaded', 400);
    }
    if (!['tmw', 'manabe', 'vncr'].includes(req.body.logImportType)) {
      throw new customError('Import type is invalid', 400);
    }
    if (req.file.size > 5 * 1024 * 1024) {
      throw new customError('File size exceeds the 5MB limit', 400);
    }

    const csvString = req.file.buffer.toString('utf8');
    const csvType = req.body.logImportType;

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
    } else if (csvType === 'vncr') {
      // Parse VN Club Resurrection JSONL format
      const lines = csvString.trim().split('\n');
      const results: VNCRLog[] = [];

      for (const line of lines) {
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            results.push(parsed);
          } catch (err) {
            console.warn('Failed to parse JSONL line:', line);
          }
        }
      }

      if (results.length === 0) {
        throw new customError('No valid data found in the JSONL file', 400);
      }
      req.body.logs = results;
    }

    return next();
  } catch (error) {
    return next(error as customError);
  }
}
