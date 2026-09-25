import { describe, expect, it, vi } from 'vitest';
import { getUserConsumedDifficulty } from '../../services/xp.js';

const mocks = vi.hoisted(() => ({
  logFind: vi.fn(),
  mediaFind: vi.fn(),
}));

vi.mock('../../models/log.model.js', () => ({
  default: { find: mocks.logFind },
}));
vi.mock('../../models/media.model.js', () => ({
  MediaBase: { find: mocks.mediaFind },
}));

describe('getUserConsumedDifficulty', () => {
  it('includes page-only logs in the consumed-difficulty window', async () => {
    mocks.logFind.mockReturnValue({
      select: vi.fn((projection: string) => ({
        lean: vi.fn().mockResolvedValue(
          projection.includes('pages')
            ? [
                {
                  mediaId: 'book-1',
                  type: 'reading',
                  pages: 400,
                  time: null,
                  chars: null,
                  episodes: null,
                },
              ]
            : []
        ),
      })),
    });
    mocks.mediaFind.mockReturnValue({
      select: vi.fn(() => ({
        lean: vi.fn().mockResolvedValue([
          { contentId: 'book-1', jitenDifficulty: 4 },
        ]),
      })),
    });

    await expect(getUserConsumedDifficulty('user-1', 'reading')).resolves.toBe(
      80
    );
  });
});
