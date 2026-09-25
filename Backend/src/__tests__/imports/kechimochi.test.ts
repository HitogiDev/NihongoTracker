import { describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { csvToArray } from '../../middlewares/csvToArray.js';
import { getLogsFromCSV } from '../../middlewares/getLogs.js';
import type { ILog } from '../../types.js';

/** Shape `getLogsFromCSV` puts back on the request (its ILogNT is private). */
type ImportedLog = {
  type: ILog['type'];
  date: Date;
  description: string;
  time?: number;
  chars?: number;
};

/**
 * Runs a Kechimochi CSV through the two middlewares the import endpoint wires
 * together, so a column rename in the export is caught here rather than by a
 * user getting a 400 on upload.
 */
async function importCsv(csv: string): Promise<ImportedLog[]> {
  const buffer = Buffer.from(csv, 'utf8');
  const req = {
    file: { buffer, size: buffer.length },
    body: { logImportType: 'kechimochi' },
  } as unknown as Request;
  const res = { locals: { user: { _id: 'user-1' } } } as unknown as Response;

  for (const middleware of [csvToArray, getLogsFromCSV]) {
    await new Promise<void>((resolve, reject) => {
      const next = ((error?: unknown) =>
        error ? reject(error) : resolve()) as NextFunction;
      void middleware(req, res, next);
    });
  }

  return req.body.logs as ImportedLog[];
}

const CURRENT_HEADER =
  'Date,Log Name,Default Activity Type,Duration,Language,Characters,Activity Type,Notes,Media Variant';

describe('Kechimochi import', () => {
  it('imports the current export, which has no "Media Type" column', async () => {
    const logs = await importCsv(
      `${CURRENT_HEADER}\n` +
        '2026-08-01,ある小説,Reading,150,Japanese,25333,Reading,,\n' +
        '2026-07-05,ある動画,Watching,72,Japanese,0,Watching,,\n'
    );

    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      type: 'reading',
      description: 'ある小説',
      time: 150,
      chars: 25333,
    });
    // Generic "Watching" with no variant stays video.
    expect(logs[1]).toMatchObject({ type: 'video', time: 72 });
    expect(logs[1].chars).toBeUndefined();
  });

  it('prefers the media over the activity when both are present', async () => {
    const [anime] = await importCsv(
      `${CURRENT_HEADER}\n` +
        '2026-01-01,あるアニメ,Watching,24,Japanese,0,Watching,,Anime\n'
    );
    expect(anime.type).toBe('anime');

    const [vn] = await importCsv(
      'Date,Log Name,Media Type,Duration,Language,Characters,Activity Type\n' +
        '2026-01-01,あるノベル,Visual Novel,60,Japanese,5000,Reading\n'
    );
    expect(vn.type).toBe('vn');
  });

  it('maps every activity Kechimochi emits, including when "Media Type" repeats it', async () => {
    const logs = await importCsv(
      'Date,Log Name,Media Type,Duration,Language,Characters,Activity Type,Notes\n' +
        '2026-04-12,ある小説,Reading,44,Japanese,0,Reading,\n' +
        '2026-04-12,あるアニメ,Watching,24,Japanese,0,Watching,\n' +
        '2026-04-16,あるドラマCD,Listening,48,Japanese,0,Listening,\n' +
        '2026-04-09,あるゲーム,Playing,23,Japanese,0,Playing,\n'
    );

    expect(logs.map((log) => log.type)).toEqual([
      'reading',
      'video',
      'audio',
      'game',
    ]);
  });

  it('rejects rows with no activity or media column at all', async () => {
    await expect(
      importCsv('Date,Log Name,Duration\n2026-01-01,なにか,60\n')
    ).rejects.toThrow(/activity or media type column/);
  });

  it('skips rows without measurable progress', async () => {
    const logs = await importCsv(
      `${CURRENT_HEADER}\n` +
        '2026-01-01,なにか,Reading,0,Japanese,0,Reading,,\n' +
        '2026-01-02,べつのなにか,Reading,30,Japanese,0,Reading,,\n'
    );

    expect(logs).toHaveLength(1);
    expect(logs[0].description).toBe('べつのなにか');
  });
});
