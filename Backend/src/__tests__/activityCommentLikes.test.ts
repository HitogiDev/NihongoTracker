import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import {
  likeActivityComment,
  unlikeActivityComment,
} from '../services/activity.service.js';

const mocks = vi.hoisted(() => ({
  activityFindById: vi.fn(),
  canViewActivity: vi.fn(),
  commentFindByIdAndUpdate: vi.fn(),
  commentFindOne: vi.fn(),
  likeCreate: vi.fn(),
  likeFindOne: vi.fn(),
  likeFindOneAndDelete: vi.fn(),
}));

vi.mock('../models/activity.model.js', () => ({
  default: { findById: mocks.activityFindById },
}));
vi.mock('../models/activityComment.model.js', () => ({
  default: {
    findByIdAndUpdate: mocks.commentFindByIdAndUpdate,
    findOne: mocks.commentFindOne,
  },
}));
vi.mock('../models/activityCommentLike.model.js', () => ({
  default: {
    create: mocks.likeCreate,
    findOne: mocks.likeFindOne,
    findOneAndDelete: mocks.likeFindOneAndDelete,
  },
}));
vi.mock('../models/activityReaction.model.js', () => ({ default: {} }));
vi.mock('../models/log.model.js', () => ({ default: {} }));
vi.mock('../models/media.model.js', () => ({ MediaBase: {} }));
vi.mock('../services/socialVisibility.service.js', () => ({
  buildVisibleActivityFilter: vi.fn(),
  canViewActivity: mocks.canViewActivity,
  getFollowedUserIds: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.activityFindById.mockResolvedValue({ _id: new Types.ObjectId() });
  mocks.canViewActivity.mockResolvedValue(true);
});

describe('activity comment likes', () => {
  it('adds one like and increments the stored count', async () => {
    const activityId = new Types.ObjectId();
    const commentId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const comment = {
      _id: commentId,
      activity: activityId,
      likeCount: 0,
    };
    const updatedComment = { ...comment, likeCount: 1 };
    mocks.commentFindOne.mockResolvedValue(comment);
    mocks.commentFindByIdAndUpdate.mockResolvedValue(updatedComment);
    mocks.likeFindOne.mockResolvedValue(null);
    mocks.likeCreate.mockResolvedValue({ _id: new Types.ObjectId() });

    const result = await likeActivityComment(activityId, commentId, userId);

    expect(result.changed).toBe(true);
    expect(result.comment.likeCount).toBe(1);
    expect(mocks.commentFindByIdAndUpdate).toHaveBeenCalledWith(
      commentId,
      { $inc: { likeCount: 1 } },
      { new: true }
    );
    expect(mocks.likeCreate).toHaveBeenCalledWith({
      comment: commentId,
      user: userId,
    });
  });

  it('does not count an existing like twice', async () => {
    const activityId = new Types.ObjectId();
    const commentId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const comment = {
      _id: commentId,
      activity: activityId,
      likeCount: 3,
    };
    mocks.commentFindOne.mockResolvedValue(comment);
    mocks.likeFindOne.mockResolvedValue({ _id: new Types.ObjectId() });

    const result = await likeActivityComment(activityId, commentId, userId);

    expect(result.changed).toBe(false);
    expect(comment.likeCount).toBe(3);
    expect(mocks.commentFindByIdAndUpdate).not.toHaveBeenCalled();
    expect(mocks.likeCreate).not.toHaveBeenCalled();
  });

  it('removes a like without letting the count go below zero', async () => {
    const activityId = new Types.ObjectId();
    const commentId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const comment = {
      _id: commentId,
      activity: activityId,
      likeCount: 0,
    };
    mocks.commentFindOne.mockResolvedValue(comment);
    mocks.likeFindOneAndDelete.mockResolvedValue({ _id: new Types.ObjectId() });
    mocks.commentFindByIdAndUpdate.mockResolvedValue(comment);

    const result = await unlikeActivityComment(activityId, commentId, userId);

    expect(result.changed).toBe(true);
    expect(result.comment.likeCount).toBe(0);
    expect(mocks.commentFindByIdAndUpdate).toHaveBeenCalledOnce();
  });
});
