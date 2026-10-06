import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { fetchJitenDetail } from '../services/jiten.js';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
describe('canonical Jiten media links', () => {
  it.each([
    ['vn', 'v123', 2, 'v123'],
    ['manga', '123', 4, '123'],
    ['light-novel', '123', 4, '123'],
    ['book', 'gbooks-abc', 6, 'abc'],
  ])(
    'looks up %s with its external link type',
    async (type, contentId, linkType, externalId) => {
      vi.stubEnv('JITEN_API_URL', 'https://jiten.example');
      vi.mocked(axios.get)
        .mockResolvedValueOnce({ status: 200, data: [42] })
        .mockResolvedValueOnce({
          status: 200,
          data: { data: { mainDeck: { characterCount: 1000 } } },
        });
      const result = await fetchJitenDetail(String(type), String(contentId));
      expect(axios.get).toHaveBeenNthCalledWith(
        1,
        `https://jiten.example/media-deck/by-link-id/${linkType}/${externalId}`,
        expect.any(Object)
      );
      expect(result?.data.mainDeck.characterCount).toBe(1000);
    }
  );
});
