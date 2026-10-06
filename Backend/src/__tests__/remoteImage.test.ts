import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  downloadAverageColorImage,
  validateImageUrl,
} from '../services/remoteImage.js';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('node:https', () => ({ get: mocks.get }));
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

function request() {
  const events = new EventEmitter();
  const result = Object.assign(events, {
    destroy: vi.fn((error?: Error) => {
      if (error) events.emit('error', error);
      events.emit('close');
    }),
  });
  mocks.get.mockReturnValue(result);
  return result;
}

function respond(statusCode: number, headers: Record<string, string>) {
  const stream = Object.assign(new PassThrough(), { statusCode, headers });
  mocks.get.mock.calls[0][1](stream);
  return stream;
}

describe('image URL boundaries', () => {
  it.each([
    'file:///etc/passwd',
    'http://127.0.0.1',
    'https://localhost',
    'https://169.254.169.254/latest/meta-data',
    'https://s4.anilist.co.attacker.test/image.jpg',
    'https://yt3.ggpht.com.attacker.test/image.jpg',
    'https://attacker.ggpht.com/image.jpg',
    'http://yt3.ggpht.com/image.jpg',
    'https://yt3.ggpht.com:8443/image.jpg',
    'https://user:password@yt3.ggpht.com/image.jpg',
    'https://attacker.test',
    'https://s4.anilist.co:8443/image.jpg',
    'https://user:password@s4.anilist.co/image.jpg',
  ])('rejects %s', (url) => {
    expect(() => validateImageUrl(url)).toThrow();
  });
  it('accepts the supported cover hosts', () => {
    expect(
      validateImageUrl(
        'https://s4.anilist.co/file/anilistcdn/media/anime/cover/image.jpg'
      ).hostname
    ).toBe('s4.anilist.co');
    expect(validateImageUrl('https://t.vndb.org/cv/01/1.jpg').hostname).toBe(
      't.vndb.org'
    );
  });

  it('accepts YouTube channel thumbnails with image transformation parameters', () => {
    const url =
      'https://yt3.ggpht.com/j-dgqmZPnXwg5eN93q0jShZZt__u26yk338g2UyfsElK93z_5vUmwy4EgLpLaKg7juE_za4-Kg=s800-c-k-c0x00ffffff-no-rj';
    expect(validateImageUrl(url).href).toBe(url);
  });

  it('rejects a redirect to an internal host before requesting it', async () => {
    const connection = request();
    const result = downloadAverageColorImage('https://s4.anilist.co/image.jpg');
    const rejected = expect(result).rejects.toMatchObject({ statusCode: 400 });
    respond(302, { location: 'http://169.254.169.254/' });
    connection.emit('close');
    await rejected;
    expect(mocks.get).toHaveBeenCalledOnce();
  });
  it('stops a streaming response above the byte limit', async () => {
    const connection = request();
    const result = downloadAverageColorImage('https://s4.anilist.co/image.jpg');
    const rejected = expect(result).rejects.toMatchObject({ statusCode: 413 });
    const stream = respond(200, { 'content-type': 'image/png' });
    stream.write(Buffer.alloc(5 * 1024 * 1024 + 1));
    await rejected;
    expect(connection.destroy).toHaveBeenCalledOnce();
    stream.destroy();
  });
  it('aborts a stalled response after five seconds', async () => {
    vi.useFakeTimers();
    const connection = request();
    const result = downloadAverageColorImage('https://s4.anilist.co/image.jpg');
    const rejected = expect(result).rejects.toMatchObject({ statusCode: 504 });
    await vi.advanceTimersByTimeAsync(5000);
    await rejected;
    expect(connection.destroy).toHaveBeenCalledOnce();
  });
});
