import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import {
  createMediaRecommendation,
  parseMediaRecommendationInput,
} from '../services/mediaRecommendation.service.js';

const mocks = vi.hoisted(() => ({
  followExists: vi.fn(),
  mediaFindOne: vi.fn(),
  recommendationCountDocuments: vi.fn(),
  recommendationCreate: vi.fn(),
  userFindOne: vi.fn(),
}));

vi.mock('../models/follow.model.js', () => ({
  default: { exists: mocks.followExists },
}));
vi.mock('../models/media.model.js', () => ({
  MediaBase: { findOne: mocks.mediaFindOne },
}));
vi.mock('../models/mediaRecommendation.model.js', () => ({
  default: {
    countDocuments: mocks.recommendationCountDocuments,
    create: mocks.recommendationCreate,
  },
}));
vi.mock('../models/user.model.js', () => ({
  default: { findOne: mocks.userFindOne },
}));

function leanQuery<T>(value: T) {
  return {
    select: () => ({ lean: () => Promise.resolve(value) }),
  };
}

function userQuery<T>(value: T) {
  return {
    collation: () => leanQuery(value),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.recommendationCountDocuments.mockResolvedValue(0);
});

describe('media recommendation service', () => {
  it('validates and trims recommendation input', () => {
    expect(
      parseMediaRecommendationInput({
        recipientUsername: ' friend ',
        mediaId: ' 123 ',
        mediaType: 'anime',
        message: ' watch this ',
      })
    ).toEqual({
      recipientUsername: 'friend',
      mediaId: '123',
      mediaType: 'anime',
      message: 'watch this',
    });
  });

  it('requires the recipient to follow the sender', async () => {
    const senderId = new Types.ObjectId();
    const recipient = {
      _id: new Types.ObjectId(),
      username: 'friend',
    };
    mocks.userFindOne.mockReturnValue(userQuery(recipient));
    mocks.mediaFindOne.mockReturnValue(leanQuery({ contentId: '123' }));
    mocks.followExists.mockResolvedValue(null);

    await expect(
      createMediaRecommendation({
        senderId,
        recipientUsername: 'friend',
        mediaId: '123',
        mediaType: 'anime',
        message: '',
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.followExists).toHaveBeenCalledWith({
      follower: recipient._id,
      following: senderId,
    });
    expect(mocks.recommendationCreate).not.toHaveBeenCalled();
  });

  it('turns the unique-index duplicate into a conflict', async () => {
    const senderId = new Types.ObjectId();
    const recipient = {
      _id: new Types.ObjectId(),
      username: 'friend',
    };
    mocks.userFindOne.mockReturnValue(userQuery(recipient));
    mocks.mediaFindOne.mockReturnValue(leanQuery({ contentId: '123' }));
    mocks.followExists.mockResolvedValue({ _id: new Types.ObjectId() });
    mocks.recommendationCreate.mockRejectedValue({ code: 11000 });

    await expect(
      createMediaRecommendation({
        senderId,
        recipientUsername: 'friend',
        mediaId: '123',
        mediaType: 'anime',
        message: '',
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('blocks the eleventh recommendation within one hour using persisted documents', async () => {
    const senderId = new Types.ObjectId();
    mocks.recommendationCountDocuments.mockResolvedValue(10);

    await expect(
      createMediaRecommendation({
        senderId,
        recipientUsername: 'friend',
        mediaId: '123',
        mediaType: 'anime',
        message: '',
      })
    ).rejects.toMatchObject({ statusCode: 429 });

    expect(mocks.recommendationCountDocuments).toHaveBeenCalledWith({
      sender: senderId,
      createdAt: { $gte: expect.any(Date) },
    });
    expect(mocks.userFindOne).not.toHaveBeenCalled();
    expect(mocks.recommendationCreate).not.toHaveBeenCalled();
  });
});
