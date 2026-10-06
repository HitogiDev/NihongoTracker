import type { assignMediaFn, searchMediaFn } from '../api/trackerApi';
import type { ILog, IMediaDocument } from '../types';

export type AutoMatchMediaType = 'anime' | 'manga' | 'game' | 'book';
type Assignment = { logsId: string[]; contentMedia: IMediaDocument };

export async function autoMatchLogGroups(options: {
  groups: Record<string, ILog[]>;
  type: AutoMatchMediaType;
  search: typeof searchMediaFn;
  assign: typeof assignMediaFn;
  onBatch: (batch: Assignment[]) => void;
}) {
  const matches: Assignment[] = [];
  for (const [groupName, logs] of Object.entries(options.groups)) {
    try {
      const results = await options.search({
        type: options.type,
        search: groupName,
        perPage: 5,
      });
      const match = results?.find((media) =>
        [
          media.title.contentTitleRomaji,
          media.title.contentTitleEnglish,
          media.title.contentTitleNative,
          ...(media.synonyms || []),
        ].some((title) => title?.toLowerCase() === groupName.toLowerCase())
      );
      if (match)
        matches.push({
          logsId: logs.map((log) => log._id),
          contentMedia: match,
        });
    } catch (error) {
      console.error(`DB search failed for: ${groupName}`, error);
    }
  }
  let totalProcessed = 0;
  for (let index = 0; index < matches.length; index += 50) {
    const batch = matches.slice(index, index + 50);
    await options.assign(batch);
    options.onBatch(batch);
    totalProcessed += batch.reduce(
      (total, assignment) => total + assignment.logsId.length,
      0
    );
  }
  return { matches: matches.length, totalProcessed };
}
