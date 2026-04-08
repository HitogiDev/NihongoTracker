import { Request, Response, NextFunction } from 'express';
import { customError } from '../middlewares/errorMiddleware.js';
import { IUser } from '../types.js';
import Log from '../models/log.model.js';
import Tag from '../models/tag.model.js';

export async function exportLogsCSV(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user: Omit<IUser, 'password'> = res.locals.user;
    if (!user) throw new customError('User not found', 404);

    // Fetch all logs for the user with tags populated
    const logs = await Log.find({ user: user._id })
      .sort({ date: -1 })
      .lean();

    // Build a map of tag IDs to tag names
    const tagIds = new Set<string>();
    for (const log of logs) {
      if (log.tags && log.tags.length > 0) {
        for (const tagId of log.tags) {
          tagIds.add(tagId.toString());
        }
      }
    }

    const tagMap = new Map<string, string>();
    if (tagIds.size > 0) {
      const tags = await Tag.find({
        _id: { $in: Array.from(tagIds) },
      }).lean();
      for (const tag of tags) {
        tagMap.set(tag._id.toString(), tag.name);
      }
    }

    // CSV header
    const headers = [
      'date',
      'type',
      'mediaId',
      'time',
      'characters',
      'episodes',
      'pages',
      'description',
      'tags',
    ];

    // Escape a CSV field value (wrap in quotes if it contains commas, quotes, or newlines)
    const escapeCSV = (value: string): string => {
      if (
        value.includes(',') ||
        value.includes('"') ||
        value.includes('\n') ||
        value.includes('\r')
      ) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const rows: string[] = [headers.join(',')];

    for (const log of logs) {
      const tagNames =
        log.tags && log.tags.length > 0
          ? log.tags
              .map((id) => tagMap.get(id.toString()) || '')
              .filter(Boolean)
              .join(';')
          : '';

      const row = [
        log.date ? new Date(log.date).toISOString().split('T')[0] : '',
        log.type || '',
        log.mediaId || '',
        log.time != null ? String(log.time) : '',
        log.chars != null ? String(log.chars) : '',
        log.episodes != null ? String(log.episodes) : '',
        log.pages != null ? String(log.pages) : '',
        log.description || '',
        tagNames,
      ].map(escapeCSV);

      rows.push(row.join(','));
    }

    const csvContent = rows.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nihongotracker-export-${user.username}-${new Date().toISOString().split('T')[0]}.csv"`
    );
    return res.send(csvContent);
  } catch (error) {
    return next(error as customError);
  }
}
