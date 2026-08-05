import { Request, Response, NextFunction } from 'express';
import { customError } from '../middlewares/errorMiddleware.js';
import { apiError } from '../i18n/errorCodes.js';
import csvtojson from 'csvtojson';
import {
  TMWLog,
  ManabeTSVLog,
  VNCRLog,
  OtherCSVLog,
  KechimochiCSVLog,
} from '../types.js';

export async function csvToArray(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    if (!req.file) {
      throw apiError('import.noFile', 400, 'No file uploaded');
    }
    if (
      !['tmw', 'manabe', 'vncr', 'other', 'kechimochi'].includes(
        req.body.logImportType
      )
    ) {
      throw apiError('import.invalidType', 400, 'Import type is invalid');
    }
    if (req.file.size > 5 * 1024 * 1024) {
      throw apiError('import.fileTooLarge', 400, 'File size exceeds the 5MB limit');
    }

    const csvString = req.file.buffer.toString('utf8');
    const csvType = req.body.logImportType;

    if (csvType === 'tmw') {
      // Parse TMW CSV format
      const results: TMWLog[] = await csvtojson({
        delimiter: ',',
      }).fromString(csvString);

      if (results.length === 0) {
        throw apiError('import.emptyCsv', 400, 'No data found in the CSV file');
      }
      req.body.logs = results;
    } else if (csvType === 'manabe') {
      // Parse Manabe TSV format
      const results: ManabeTSVLog[] = await csvtojson({
        delimiter: '\t',
      }).fromString(csvString);

      if (results.length === 0) {
        throw apiError('import.emptyTsv', 400, 'No data found in the TSV file');
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
        throw apiError('import.emptyJsonl', 400, 'No valid data found in the JSONL file');
      }
      req.body.logs = results;
    } else if (csvType === 'other') {
      // Parse Other CSV format
      const results: OtherCSVLog[] = await csvtojson({
        delimiter: ',',
      }).fromString(csvString);

      if (results.length === 0) {
        throw apiError('import.emptyCsv', 400, 'No data found in the CSV file');
      }

      // Validate required fields
      for (const row of results) {
        if (!row.date || !row.type) {
          throw apiError(
            'import.rowMissingFields',
            400,
            'Each row must have at least a "date" and "type" field'
          );
        }
      }

      req.body.logs = results;
    } else if (csvType === 'kechimochi') {
      // Parse Kechimochi activity CSV format
      const results: KechimochiCSVLog[] = await csvtojson({
        delimiter: ',',
      }).fromString(csvString);

      if (results.length === 0) {
        throw apiError('import.emptyCsv', 400, 'No data found in the CSV file');
      }

      for (const row of results) {
        if (
          !row.Date ||
          !row['Log Name'] ||
          !row['Media Type'] ||
          !row.Duration
        ) {
          throw apiError(
            'import.rowMissingColumns',
            400,
            'Each row must have "Date", "Log Name", "Media Type", and "Duration" fields'
          );
        }
      }

      req.body.logs = results;
    }

    return next();
  } catch (error) {
    return next(error as customError);
  }
}
