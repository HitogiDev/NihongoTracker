import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { notifyMentionedUsers } from '../services/mentions.service.js';

const mocks = vi.hoisted(() => ({
  userFind: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock('../models/user.model.js', () => ({
  default: { find: mocks.userFind },
}));
vi.mock('../services/notifications.service.js', () => ({
  createNotification: mocks.createNotification,
}));

function mockUsers(ids: Types.ObjectId[]) {
  mocks.userFind.mockReturnValue({
    collation: () => ({
      select: () => Promise.resolve(ids.map((_id) => ({ _id }))),
    }),
  });
}

const actor = { _id: new Types.ObjectId(), username: 'author' };
const baseInput = {
  actor,
  entityType: 'activityComment' as const,
  entityId: 'comment-1',
  link: '/?activity=1',
  title: 'author mentioned you in a comment',
  titleKey: 'social.mentionedInComment',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createNotification.mockResolvedValue(null);
});

describe('notifyMentionedUsers', () => {
  it('notifies mentioned users except the actor and excluded users', async () => {
    const mentioned = new Types.ObjectId();
    const excluded = new Types.ObjectId();
    mockUsers([mentioned, excluded, actor._id]);

    await notifyMentionedUsers({
      ...baseInput,
      content: '@one @two @author',
      excludeUserIds: [excluded],
    });

    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: mentioned,
        type: 'mention',
        groupKey: 'mention:activityComment:comment-1',
      })
    );
  });

  it('skips users that cannot view the content', async () => {
    const allowed = new Types.ObjectId();
    const blocked = new Types.ObjectId();
    mockUsers([allowed, blocked]);

    await notifyMentionedUsers({
      ...baseInput,
      content: '@allowed @blocked',
      canView: async (userId) => userId.equals(allowed),
    });

    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: allowed })
    );
  });

  it('does not query users when an edit adds no new mention', async () => {
    await notifyMentionedUsers({
      ...baseInput,
      content: 'still @alice',
      previousContent: '@alice',
    });

    expect(mocks.userFind).not.toHaveBeenCalled();
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });
});
