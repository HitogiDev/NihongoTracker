import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { getIgdbGame, searchIgdb } from '../services/searchIgdb.js';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));

const explorersOfSky = {
  id: 2323,
  name: 'Pokémon Mystery Dungeon: Explorers of Sky',
  game_type: 10,
  alternative_names: [
    {
      name: 'Pokémon Fushigi no Dungeon: Sora no tankentai',
      comment: 'Japanese title - romanization',
    },
  ],
  language_supports: [
    { language: { locale: 'ja-JP', name: 'Japanese' } },
  ],
};

describe('IGDB game eligibility', () => {
  beforeEach(() => {
    vi.stubEnv('IGDB_CLIENT_ID', 'test-client');
    vi.stubEnv('IGDB_CLIENT_SECRET', 'test-secret');
    vi.mocked(axios.post).mockImplementation(async (url) => ({
      data: String(url).includes('oauth2/token')
        ? { access_token: 'test-token', expires_in: 3600 }
        : [explorersOfSky],
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('finds Explorers of Sky with the current IGDB game_type field', async () => {
    const results = await searchIgdb(explorersOfSky.name);

    expect(results).toEqual([
      expect.objectContaining({
        contentId: 'igdb-2323',
        title: expect.objectContaining({
          contentTitleEnglish: explorersOfSky.name,
        }),
        type: 'game',
      }),
    ]);
    expect(axios.post).toHaveBeenCalledWith(
      'https://api.igdb.com/v4/games',
      expect.stringContaining('game_type'),
      expect.any(Object)
    );
  });

  it('loads an expanded game directly by ID', async () => {
    expect(await getIgdbGame(2323)).toMatchObject({ contentId: 'igdb-2323' });
    expect(axios.post).toHaveBeenCalledWith(
      'https://api.igdb.com/v4/games',
      expect.stringContaining('game_type'),
      expect.any(Object)
    );
  });

  it.each([0, 4, 8, 9, 10, 11])(
    'accepts a Japanese standalone game with type %s',
    async (gameType) => {
      vi.mocked(axios.post).mockResolvedValue({
        data: [{ ...explorersOfSky, game_type: gameType }],
      });

      expect(await getIgdbGame(2323)).toMatchObject({ contentId: 'igdb-2323' });
    }
  );

  it.each([1, 2, 3, 5, 6, 7, 12, 13, 14, 99, null, undefined])(
    'rejects an unsupported or missing game type %s',
    async (gameType) => {
      vi.mocked(axios.post).mockResolvedValue({
        data: [{ ...explorersOfSky, game_type: gameType }],
      });

      expect(await getIgdbGame(2323)).toBeNull();
    }
  );

  it('preserves support for legacy category metadata', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: [{ ...explorersOfSky, game_type: undefined, category: 0 }],
    });

    expect(await getIgdbGame(2323)).toMatchObject({ contentId: 'igdb-2323' });
  });

  it('prefers game_type over a conflicting legacy category', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: [{ ...explorersOfSky, game_type: 1, category: 0 }],
    });

    expect(await getIgdbGame(2323)).toBeNull();
  });

  it('still rejects games whose language metadata excludes Japanese', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: [{
        ...explorersOfSky,
        language_supports: [{ language: { locale: 'en-US', name: 'English' } }],
      }],
    });

    expect(await getIgdbGame(2323)).toBeNull();
  });
});
