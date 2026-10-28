import { Types } from 'mongoose';
import Notification from '../models/notification.model.js';
import { INotification, NotificationType } from '../types.js';
import {
  sendPushToUser,
  sendPushToUsers,
} from './pushNotifications.service.js';

type IdLike = Types.ObjectId | string;

export interface CreateNotificationInput {
  /** User that receives the notification. */
  recipient: IdLike;
  /** User that caused it. Self-notifications are skipped automatically. */
  actor?: IdLike | null;
  type: NotificationType;
  /** English text. Always required so nothing regresses if a key is missing. */
  title: string;
  body?: string;
  /** Translation keys. Interpolation values travel in `meta`. */
  titleKey?: string;
  bodyKey?: string;
  /** Frontend route to open when the notification is clicked. */
  link?: string;
  /** Image override (media cover, club icon…). Falls back to actor avatar. */
  image?: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, string>;
  /**
   * Collapse repeated events into a single row. When a notification with the
   * same recipient + groupKey already exists it is refreshed (count++, marked
   * unread, title/body updated) instead of inserting a duplicate.
   */
  groupKey?: string;
  /** Auto-delete date (TTL index). */
  expireAt?: Date;
  /** Allow notifying yourself (default false). */
  allowSelf?: boolean;
}

function toObjectId(value: IdLike): Types.ObjectId {
  return typeof value === 'string'
    ? Types.ObjectId.createFromHexString(value)
    : value;
}

/**
 * Create (or aggregate) a notification. Never throws: notification delivery
 * must not break the request that triggered it.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<INotification | null> {
  try {
    const recipient = toObjectId(input.recipient);
    const actor = input.actor ? toObjectId(input.actor) : null;

    if (!input.allowSelf && actor && actor.equals(recipient)) {
      return null;
    }

    const payload = {
      recipient,
      actor,
      type: input.type,
      title: input.title,
      body: input.body,
      titleKey: input.titleKey ?? null,
      bodyKey: input.bodyKey ?? null,
      link: input.link,
      image: input.image,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      meta: input.meta,
      groupKey: input.groupKey ?? null,
      expireAt: input.expireAt ?? null,
    };

    let notification: INotification | null;
    if (input.groupKey) {
      notification = await Notification.findOneAndUpdate(
        { recipient, groupKey: input.groupKey },
        {
          $set: { ...payload, isRead: false, readAt: null },
          $inc: { count: 1 },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else {
      notification = await Notification.create({ ...payload, count: 1 });
    }

    if (notification) {
      void sendPushToUser(recipient, {
        title: notification.title,
        body: notification.body,
        titleKey: notification.titleKey,
        bodyKey: notification.bodyKey,
        meta: notification.meta,
        link: notification.link,
        notificationId: String(notification._id),
        tag: notification.groupKey,
      });
    }
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

/** Fan-out helper: same notification to many recipients. */
export async function createNotifications(
  recipients: IdLike[],
  input: Omit<CreateNotificationInput, 'recipient'>
): Promise<void> {
  await Promise.all(
    recipients.map((recipient) => createNotification({ ...input, recipient }))
  );
}

const BROADCAST_BATCH_SIZE = 1000;

/**
 * Insert one notification for each recipient in batches. Use this for large
 * audiences, where one write for each user is too slow. Grouping and the
 * self-notification check do not apply.
 */
export async function insertNotificationBatches(
  recipients: AsyncIterable<IdLike> | Iterable<IdLike>,
  input: Omit<CreateNotificationInput, 'recipient' | 'groupKey' | 'allowSelf'>
): Promise<number> {
  const base = {
    actor: input.actor ? toObjectId(input.actor) : null,
    type: input.type,
    title: input.title,
    body: input.body,
    titleKey: input.titleKey ?? null,
    bodyKey: input.bodyKey ?? null,
    link: input.link,
    image: input.image,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    meta: input.meta,
    groupKey: null,
    expireAt: input.expireAt ?? null,
    count: 1,
  };

  let inserted = 0;
  let batch: Array<typeof base & { recipient: Types.ObjectId }> = [];

  const flush = async () => {
    if (batch.length === 0) return;
    const docs = batch;
    batch = [];
    await Notification.insertMany(docs, { ordered: false });
    inserted += docs.length;
    // Send push messages in the background so a large broadcast does not wait for Firebase.
    void sendPushToUsers(
      docs.map((doc) => doc.recipient),
      input
    );
  };

  for await (const recipient of recipients) {
    batch.push({ ...base, recipient: toObjectId(recipient) });
    if (batch.length >= BROADCAST_BATCH_SIZE) await flush();
  }
  await flush();

  return inserted;
}

/**
 * Remove notifications tied to an entity that no longer exists (an unliked
 * review, a deleted comment…). Safe to call when nothing matches.
 */
export async function removeNotifications(filter: {
  recipient?: IdLike;
  actor?: IdLike;
  type?: NotificationType;
  entityType?: string;
  entityId?: string;
  groupKey?: string;
}): Promise<void> {
  try {
    const query: Record<string, unknown> = {};
    if (filter.recipient) query.recipient = toObjectId(filter.recipient);
    if (filter.actor) query.actor = toObjectId(filter.actor);
    if (filter.type) query.type = filter.type;
    if (filter.entityType) query.entityType = filter.entityType;
    if (filter.entityId) query.entityId = filter.entityId;
    if (filter.groupKey) query.groupKey = filter.groupKey;

    if (Object.keys(query).length === 0) return;

    await Notification.deleteMany(query);
  } catch (error) {
    console.error('Failed to remove notifications:', error);
  }
}

/**
 * Decrement an aggregated notification (e.g. a user removes their like).
 * Deletes the row when the count reaches zero.
 */
export async function decrementNotification(
  recipient: IdLike,
  groupKey: string
): Promise<void> {
  try {
    const notification = await Notification.findOneAndUpdate(
      { recipient: toObjectId(recipient), groupKey },
      { $inc: { count: -1 } },
      { new: true }
    );

    if (notification && notification.count <= 0) {
      await notification.deleteOne();
    }
  } catch (error) {
    console.error('Failed to decrement notification:', error);
  }
}

export async function countUnreadNotifications(
  recipient: IdLike
): Promise<number> {
  return Notification.countDocuments({
    recipient: toObjectId(recipient),
    isRead: false,
  });
}
