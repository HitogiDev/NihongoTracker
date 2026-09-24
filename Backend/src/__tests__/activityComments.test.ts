import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { createActivityComment } from '../services/activity.service.js';

const mocks = vi.hoisted(() => ({
  activityFindById: vi.fn(),
  activityUpdateOne: vi.fn(),
  canCommentOnUserLogs: vi.fn(),
  canViewActivity: vi.fn(),
  commentCreate: vi.fn(),
  commentFindOne: vi.fn(),
}));

vi.mock('../models/activity.model.js', () => ({
  default: {
    findById: mocks.activityFindById,
    updateOne: mocks.activityUpdateOne,
  },
}));
vi.mock('../models/activityComment.model.js', () => ({
  default: {
    create: mocks.commentCreate,
    findOne: mocks.commentFindOne,
  },
}));
vi.mock('../models/activityCommentLike.model.js', () => ({ default: {} }));
vi.mock('../models/activityReaction.model.js', () => ({ default: {} }));
vi.mock('../models/log.model.js', () => ({ default: {} }));
vi.mock('../models/media.model.js', () => ({ MediaBase: {} }));
vi.mock('../services/socialVisibility.service.js', () => ({
  buildVisibleActivityFilter: vi.fn(),
  canCommentOnUserLogs: mocks.canCommentOnUserLogs,
  canViewActivity: mocks.canViewActivity,
  getFollowerUserIds: vi.fn(),
  getFollowedUserIds: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canViewActivity.mockResolvedValue(true);
  mocks.canCommentOnUserLogs.mockResolvedValue(true);
  mocks.activityUpdateOne.mockResolvedValue({ acknowledged: true });
});

describe('activity comment replies', () => {
  it('stores the parent comment when creating a reply', async () => {
    const activityId = new Types.ObjectId();
    const parentCommentId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const activity = { _id: activityId, actor: new Types.ObjectId() };
    const parentComment = { _id: parentCommentId, user: new Types.ObjectId() };
    const comment = {
      _id: new Types.ObjectId(),
      populate: vi.fn().mockResolvedValue(undefined),
    };
    mocks.activityFindById.mockResolvedValue(activity);
    mocks.commentFindOne.mockReturnValue({
      select: () => Promise.resolve(parentComment),
    });
    mocks.commentCreate.mockResolvedValue(comment);

    const result = await createActivityComment(
      activityId,
      userId,
      'A reply',
      parentCommentId
    );

    expect(mocks.commentFindOne).toHaveBeenCalledWith({
      _id: parentCommentId,
      activity: activityId,
    });
    expect(mocks.commentCreate).toHaveBeenCalledWith({
      activity: activityId,
      user: userId,
      parentComment: parentCommentId,
      content: 'A reply',
    });
    expect(result.parentComment).toBe(parentComment);
  });

  it('rejects a parent comment from another activity', async () => {
    const activityId = new Types.ObjectId();
    const parentCommentId = new Types.ObjectId();
    mocks.activityFindById.mockResolvedValue({
      _id: activityId,
      actor: new Types.ObjectId(),
    });
    mocks.commentFindOne.mockReturnValue({
      select: () => Promise.resolve(null),
    });

    await expect(
      createActivityComment(
        activityId,
        new Types.ObjectId(),
        'A reply',
        parentCommentId
      )
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.commentCreate).not.toHaveBeenCalled();
  });
});
