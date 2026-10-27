import { Types } from 'mongoose';
import User from '../models/user.model.js';
import { extractNewMentions } from './mentionParser.js';
import { createNotification } from './notifications.service.js';

interface MentionActor {
  _id: Types.ObjectId;
  username: string;
  avatar?: string;
}

export interface NotifyMentionsInput {
  content: string;
  /** Text before an edit. Users that it already mentioned are not notified again. */
  previousContent?: string;
  actor: MentionActor;
  entityType: 'activityComment' | 'mediaReview';
  entityId: string;
  link: string;
  title: string;
  titleKey: string;
  body?: string;
  /** Users that already get a different notification for the same event. */
  excludeUserIds?: Types.ObjectId[];
  /** Skip users that cannot open the mentioned content. */
  canView?: (userId: Types.ObjectId) => Promise<boolean>;
  meta?: Record<string, string>;
}

/**
 * Notify users that a text mentions for the first time.
 * Never throws, because a mention must not break the request that saved the text.
 */
export async function notifyMentionedUsers(
  input: NotifyMentionsInput
): Promise<void> {
  try {
    const usernames = extractNewMentions(input.content, input.previousContent);
    if (usernames.length === 0) return;

    const users = await User.find({
      username: { $in: usernames },
      'moderation.banned': { $ne: true },
    })
      .collation({ locale: 'en', strength: 2 })
      .select('_id');

    const excluded = new Set(
      [input.actor._id, ...(input.excludeUserIds ?? [])].map(String)
    );

    await Promise.all(
      users.map(async (user) => {
        const recipient = user._id as Types.ObjectId;
        if (excluded.has(String(recipient))) return;
        if (input.canView && !(await input.canView(recipient))) return;
        await createNotification({
          recipient,
          actor: input.actor._id,
          type: 'mention',
          title: input.title,
          titleKey: input.titleKey,
          body: input.body,
          link: input.link,
          entityType: input.entityType,
          entityId: input.entityId,
          // One row for each mention source, so that repeated edits refresh it.
          groupKey: `mention:${input.entityType}:${input.entityId}`,
          meta: {
            username: input.actor.username,
            avatar: input.actor.avatar ?? '',
            ...input.meta,
          },
        });
      })
    );
  } catch (error) {
    console.error('Failed to notify mentioned users:', error);
  }
}
