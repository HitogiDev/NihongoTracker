import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertDecorationAllowed,
  createPost,
  parseExternalImageUrls,
  parsePostContent,
  parsePostVisibility,
  parseStringListField,
} from '../services/posts.service.js';
import { hasHostedPostImages } from '../services/postImageAccess.js';
import {
  parsePostDecorationInput,
  storedDecorationSignature,
} from '../services/postDecoration.js';

const mocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  countDocuments: vi.fn(),
  postCreate: vi.fn(),
  postDeleteOne: vi.fn(),
  activityCreate: vi.fn(),
  upload: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  encode: vi.fn(),
}));

vi.mock('../models/post.model.js', () => ({
  POST_CONTENT_MAX_LENGTH: 4000,
  POST_IMAGES_MAX: 4,
  default: {
    aggregate: mocks.aggregate,
    countDocuments: mocks.countDocuments,
    create: mocks.postCreate,
    deleteOne: mocks.postDeleteOne,
  },
}));
vi.mock('../models/activity.model.js', () => ({
  default: { create: mocks.activityCreate },
}));
vi.mock('../services/activity.service.js', () => ({
  deleteActivitiesBySource: vi.fn(),
}));
vi.mock('../services/notifications.service.js', () => ({
  removeNotifications: vi.fn(),
}));
vi.mock('../services/uploadFile.js', () => ({
  deleteFile: vi.fn(),
  FileUploadBatch: class {
    upload = mocks.upload;

    remove = vi.fn();

    commit = mocks.commit;

    rollback = mocks.rollback;
  },
}));
vi.mock('../services/remoteImage.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/remoteImage.js')>()),
  encodePostImageWithInfo: mocks.encode,
}));

const freeUser = { _id: new Types.ObjectId(), roles: ['user'] } as never;
const enthusiast = {
  _id: new Types.ObjectId(),
  roles: ['user'],
  patreon: { isActive: true, tier: 'enthusiast' },
} as never;

function file(mimetype = 'image/png', size = 1000) {
  return {
    fieldname: 'images',
    originalname: 'image.png',
    mimetype,
    size,
    buffer: Buffer.from('image'),
  } as Express.Multer.File;
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    content: 'Hello',
    visibility: 'public' as const,
    sensitive: false,
    externalUrls: [],
    files: [],
    decoration: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.aggregate.mockResolvedValue([]);
  mocks.postDeleteOne.mockResolvedValue({});
  mocks.countDocuments.mockResolvedValue(0);
  mocks.encode.mockResolvedValue({
    data: Buffer.from('webp'),
    width: 100,
    height: 50,
  });
  mocks.upload.mockResolvedValue({ downloadURL: 'https://firebasestorage.googleapis.com/x' });
  mocks.postCreate.mockImplementation(async (doc) => ({
    ...doc,
    _id: new Types.ObjectId(),
    createdAt: new Date(),
    images: doc.images.map((image: object) => ({
      ...image,
      _id: new Types.ObjectId(),
    })),
  }));
  mocks.activityCreate.mockResolvedValue({ _id: new Types.ObjectId() });
});

describe('post input parsing', () => {
  it('trims content and rejects long posts', () => {
    expect(parsePostContent('  hi  ')).toBe('hi');
    expect(() => parsePostContent('a'.repeat(4001))).toThrow(
      expect.objectContaining({ code: 'post.contentTooLong' })
    );
  });

  it('defaults visibility to public and rejects unknown values', () => {
    expect(parsePostVisibility(undefined)).toBe('public');
    expect(parsePostVisibility('followers')).toBe('followers');
    expect(() => parsePostVisibility('friends')).toThrow(
      expect.objectContaining({ code: 'privacy.invalidVisibility' })
    );
  });

  it('reads image lists from JSON strings and arrays', () => {
    expect(parseStringListField('["a","b"]')).toEqual(['a', 'b']);
    expect(parseStringListField(['a'])).toEqual(['a']);
    expect(parseStringListField(undefined)).toEqual([]);
    expect(() => parseStringListField('{')).toThrow(
      expect.objectContaining({ code: 'post.invalidImageList' })
    );
    expect(() => parseStringListField('[1]')).toThrow(
      expect.objectContaining({ code: 'post.invalidImageList' })
    );
  });

  it('accepts allowlisted image hosts and removes duplicates', () => {
    expect(
      parseExternalImageUrls(
        '["https://i.imgur.com/a.png","https://i.imgur.com/a.png"]'
      )
    ).toEqual(['https://i.imgur.com/a.png']);
  });

  it.each([
    'https://example.com/a.png',
    'http://i.imgur.com/a.png',
    'https://i.imgur.com:8443/a.png',
    'https://i.imgur.com.attacker.test/a.png',
    'https://firebasestorage.googleapis.com/a.png',
  ])('rejects %s', (url) => {
    expect(() => parseExternalImageUrls([url])).toThrow(
      expect.objectContaining({ code: 'post.unsupportedImageHost' })
    );
  });

  it('rejects text that is not a URL', () => {
    expect(() => parseExternalImageUrls(['not a url'])).toThrow(
      expect.objectContaining({ code: 'post.invalidImageUrl' })
    );
  });
});

describe('hosted post image access', () => {
  it.each([
    [{ roles: ['user'] }, false],
    [{ roles: ['user'], patreon: { isActive: true, tier: 'donator' } }, false],
    [{ roles: ['user'], patreon: { isActive: false, tier: 'consumer' } }, false],
    [{ roles: ['user'], patreon: { isActive: true, tier: 'enthusiast' } }, true],
    [{ roles: ['user'], patreon: { isActive: true, tier: 'consumer' } }, true],
    [{ roles: ['admin'] }, true],
  ])('returns the expected access for %j', (user, expected) => {
    expect(hasHostedPostImages(user as never)).toBe(expected);
  });
});

describe('createPost', () => {
  it('lets free users post external images', async () => {
    await createPost(
      freeUser,
      input({ externalUrls: ['https://i.imgur.com/a.png'] })
    );
    expect(mocks.postCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [{ url: 'https://i.imgur.com/a.png', source: 'external' }],
      })
    );
    expect(mocks.activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'post', targetType: 'post' })
    );
  });

  it('rejects uploads from free users before any upload', async () => {
    await expect(createPost(freeUser, input({ files: [file()] }))).rejects.toMatchObject({
      code: 'post.hostedImagesTierRequired',
    });
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('uploads re-encoded WebP images for supporters', async () => {
    await createPost(enthusiast, input({ files: [file()] }));
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.objectContaining({ mimetype: 'image/webp', fieldname: 'postImage' }),
      undefined,
      expect.anything()
    );
    expect(mocks.commit).toHaveBeenCalled();
  });

  it('rejects unsupported file types', async () => {
    await expect(
      createPost(enthusiast, input({ files: [file('image/svg+xml')] }))
    ).rejects.toMatchObject({ code: 'post.invalidImage' });
    expect(mocks.rollback).toHaveBeenCalled();
  });

  it('enforces the hosted image quota', async () => {
    mocks.aggregate.mockResolvedValue([{ count: 120 }]);
    await expect(
      createPost(enthusiast, input({ files: [file()] }))
    ).rejects.toMatchObject({ code: 'post.hostedImageQuota' });
  });

  it('rejects empty posts and too many images', async () => {
    await expect(createPost(freeUser, input({ content: '' }))).rejects.toMatchObject({
      code: 'post.empty',
    });
    await expect(
      createPost(
        enthusiast,
        input({
          externalUrls: ['https://i.imgur.com/a.png', 'https://i.imgur.com/b.png'],
          files: [file(), file(), file()],
        })
      )
    ).rejects.toMatchObject({ code: 'post.tooManyImages' });
  });

  it('removes the post and the uploads when the activity fails', async () => {
    mocks.activityCreate.mockRejectedValue(new Error('db'));
    await expect(createPost(enthusiast, input({ files: [file()] }))).rejects.toThrow('db');
    expect(mocks.postDeleteOne).toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
});

describe('post decorations', () => {
  const imageDecoration = (extra: Record<string, unknown> = {}) =>
    parsePostDecorationInput(
      JSON.stringify({
        border: { style: 'gradient', color1: '#FF0000', color2: '#00ff00' },
        background: { type: 'image', opacity: 140, ...extra },
      })
    );

  it('returns null without a border or a background', () => {
    expect(parsePostDecorationInput(undefined)).toBeNull();
    expect(parsePostDecorationInput('{}')).toBeNull();
    expect(
      parsePostDecorationInput({ border: { style: 'none' }, background: { type: 'none' } })
    ).toBeNull();
  });

  it('normalizes colors and clamps opacity', () => {
    const decoration = imageDecoration({ imageUrl: 'https://i.imgur.com/bg.png' });
    expect(decoration?.border.color1).toBe('#ff0000');
    expect(decoration?.background.opacity).toBe(100);
    expect(decoration?.background.imageUrl).toBe('https://i.imgur.com/bg.png');
  });

  it.each([
    { border: { style: 'wavy' } },
    { border: { style: 'solid', color1: 'red' } },
    { background: { type: 'pattern', pattern: 'hearts' } },
    { background: { type: 'color', opacity: 'a lot' } },
  ])('rejects %j', (value) => {
    expect(() => parsePostDecorationInput(value)).toThrow(
      expect.objectContaining({ code: 'post.invalidDecoration' })
    );
  });

  it('rejects background links from unsupported hosts', () => {
    expect(() => imageDecoration({ imageUrl: 'https://example.com/a.png' })).toThrow(
      expect.objectContaining({ code: 'post.unsupportedImageHost' })
    );
  });

  it('requires an image for an image background', () => {
    expect(() =>
      assertDecorationAllowed(enthusiast, imageDecoration(), undefined, null)
    ).toThrow(expect.objectContaining({ code: 'post.decorationImageRequired' }));
  });

  it('requires a supporter tier to add a decoration', () => {
    const decoration = parsePostDecorationInput({ background: { type: 'color' } });
    expect(() =>
      assertDecorationAllowed(freeUser, decoration, undefined, null)
    ).toThrow(expect.objectContaining({ code: 'post.decorationTierRequired' }));
    expect(() =>
      assertDecorationAllowed(enthusiast, decoration, undefined, null)
    ).not.toThrow();
  });

  it('lets a downgraded user keep an unchanged decoration', () => {
    const current = {
      border: { style: 'solid', color1: '#ff0000', color2: '#00ff00' },
      background: {
        type: 'image',
        color: '#1e293b',
        pattern: 'dots',
        patternColor: '#a855f7',
        opacity: 60,
        image: { url: 'https://cdn.example/bg.webp', source: 'hosted' },
      },
    } as never;
    const same = parsePostDecorationInput({
      border: { style: 'solid', color1: '#ff0000', color2: '#123456' },
      background: { type: 'image', opacity: 60, keepImage: true, color: '#000000' },
    });
    expect(() => assertDecorationAllowed(freeUser, same, undefined, current)).not.toThrow();
    const changed = parsePostDecorationInput({
      border: { style: 'solid', color1: '#ff0000' },
      background: { type: 'image', opacity: 30, keepImage: true },
    });
    expect(() => assertDecorationAllowed(freeUser, changed, undefined, current)).toThrow(
      expect.objectContaining({ code: 'post.decorationTierRequired' })
    );
    expect(() => assertDecorationAllowed(freeUser, null, undefined, current)).toThrow(
      expect.objectContaining({ code: 'post.decorationTierRequired' })
    );
    expect(storedDecorationSignature(null)).toBe('none');
  });

  it('uploads a hosted background and counts it toward the quota', async () => {
    mocks.aggregate.mockResolvedValue([{ count: 119 }]);
    mocks.countDocuments.mockResolvedValue(1);
    await expect(
      createPost(
        enthusiast,
        input({ decoration: imageDecoration(), backgroundFile: file() })
      )
    ).rejects.toMatchObject({ code: 'post.hostedImageQuota' });

    mocks.countDocuments.mockResolvedValue(0);
    await createPost(
      enthusiast,
      input({ decoration: imageDecoration(), backgroundFile: file() })
    );
    expect(mocks.postCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        decoration: expect.objectContaining({
          background: expect.objectContaining({
            type: 'image',
            image: expect.objectContaining({ source: 'hosted' }),
          }),
        }),
      })
    );
  });
});
