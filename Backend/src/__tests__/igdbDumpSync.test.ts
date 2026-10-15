import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isIgdbDumpSyncRunningInProcess,
  startIgdbDumpSync,
} from '../services/igdbDumpSync.js';

const mocks = vi.hoisted(() => ({
  stateFind: vi.fn(),
  stateUpdate: vi.fn(),
  lock: vi.fn(),
  find: vi.fn(),
  bulkWrite: vi.fn(),
  deleteMany: vi.fn(),
  dumpList: vi.fn(),
  dumpDetails: vi.fn(),
  dumpStream: vi.fn(),
  addDocuments: vi.fn(),
  deleteDocuments: vi.fn(),
}));

vi.mock('../models/igdbDumpSyncState.model.js', () => ({
  IGDB_DUMP_ENDPOINTS: ['games', 'genres', 'platforms'],
  IGDB_DUMP_SYNC_STATE_ID: 'igdb-dump-sync',
  default: {
    findById: mocks.stateFind,
    findByIdAndUpdate: mocks.stateUpdate,
    findOneAndUpdate: mocks.lock,
  },
}));
vi.mock('../models/media.model.js', () => ({
  MediaBase: {
    find: mocks.find,
    bulkWrite: mocks.bulkWrite,
    deleteMany: mocks.deleteMany,
  },
}));
vi.mock('../services/igdbDumpClient.js', () => ({
  getIgdbDumpList: mocks.dumpList,
  getIgdbDumpDetails: mocks.dumpDetails,
  getIgdbDumpStream: mocks.dumpStream,
}));
vi.mock('../services/meilisearch/meiliSearch.js', () => ({
  addDocuments: mocks.addDocuments,
  deleteDocuments: mocks.deleteDocuments,
}));

describe('IGDB dump game eligibility', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('IGDB_DUMP_SYNC_ENDPOINTS', 'games');
    const query = () => ({ lean: () => ({ exec: async () => ({}) }) });
    mocks.stateFind.mockImplementation(query);
    mocks.stateUpdate.mockImplementation(query);
    mocks.lock.mockImplementation(query);
    mocks.find.mockReturnValue({ select: () => ({ lean: async () => [] }) });
    mocks.dumpList.mockResolvedValue([{ endpoint: 'games' }]);
    mocks.dumpDetails.mockImplementation(async (endpoint: string) => ({
      endpoint,
      s3_url: endpoint,
      file_name: `${endpoint}.csv`,
      updated_at: 1,
      schema_version: '1',
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(['game_type', 'category'])(
    'imports standalone Japanese games from %s and keeps them during cleanup',
    async (typeField) => {
      const supportedTypes = [0, 4, 8, 9, 10, 11];
      const unsupportedTypes = [1, 2, 3, 5, 6, 7, 12, 13, 14];
      const rows = [...supportedTypes, ...unsupportedTypes].map(
        (gameType) => `${2323 + gameType},Game ${gameType},${gameType},1`
      );
      const dumps: Record<string, string> = {
        covers: 'id,image_id\n1,cover123\n',
        languages: 'id,name,locale\n16,Japanese,ja-JP\n',
        language_supports: `id,game,language\n${[...supportedTypes, ...unsupportedTypes]
          .map((gameType) => `${gameType + 1},${2323 + gameType},16`)
          .join('\n')}\n`,
        games: `id,name,${typeField},updated_at\n${rows.join('\n')}\n`,
      };
      mocks.dumpStream.mockImplementation(async (endpoint: string) =>
        Readable.from([dumps[endpoint]])
      );
      mocks.find.mockImplementation((filter: { contentId: unknown }) => ({
        select: () => ({
          lean: async () => filter.contentId instanceof RegExp
            ? supportedTypes.map((gameType) => ({
              _id: String(2323 + gameType),
              contentId: `igdb-${2323 + gameType}`,
            }))
            : [],
        }),
      }));

      expect((await startIgdbDumpSync('manual', { force: true })).started).toBe(true);
      await vi.waitFor(() => expect(isIgdbDumpSyncRunningInProcess()).toBe(false));

      expect(mocks.bulkWrite).toHaveBeenCalledOnce();
      const operations = mocks.bulkWrite.mock.calls[0][0] as Array<{
        updateOne: { filter: { contentId: string } };
      }>;
      expect(operations.map((operation) => operation.updateOne.filter.contentId))
        .toEqual(supportedTypes.map((gameType) => `igdb-${2323 + gameType}`));
      expect(mocks.deleteMany).not.toHaveBeenCalled();
      expect(mocks.deleteDocuments).not.toHaveBeenCalled();
      expect(mocks.stateUpdate).toHaveBeenCalledWith(
        'igdb-dump-sync',
        expect.objectContaining({
          $set: expect.objectContaining({ currentMessage: 'IGDB dump sync completed' }),
        }),
        expect.any(Object)
      );
    }
  );
});
