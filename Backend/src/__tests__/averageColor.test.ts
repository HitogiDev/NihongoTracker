import type { Request, Response } from 'express';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAverageColor } from '../controllers/media.controller.js';

const mocks = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock('../services/remoteImage.js', () => ({
  downloadAverageColorImage: mocks.download,
}));
vi.mock('../services/meilisearch/meiliClient.js', () => ({
  default: {},
}));

afterEach(() => vi.clearAllMocks());

describe('average color image dimensions', () => {
  it.each([
    [230, 325],
    [325, 230],
    [100, 100],
    [1, 100],
    [100, 1],
  ])('returns the cover color for a %i by %i image', async (width, height) => {
    const image = await sharp({
      create: { width, height, channels: 3, background: '#2468ac' },
    })
      .resize(50, 50, { fit: 'inside' })
      .png()
      .toBuffer();
    mocks.download.mockResolvedValue(image);
    const imageUrl = 'https://s4.anilist.co/cover.jpg';
    const req = { query: { imageUrl } } as unknown as Request;
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    const next = vi.fn();

    await getAverageColor(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.download).toHaveBeenCalledWith(imageUrl);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        hex: '#2468ac',
        value: [36, 104, 172, 255],
        isDark: true,
        isLight: false,
      })
    );
  });
});
