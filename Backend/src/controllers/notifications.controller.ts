import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Club } from '../models/club.model.js';
import Changelog from '../models/changelog.model.js';
import Notification from '../models/notification.model.js';
import { customError } from '../middlewares/errorMiddleware.js';
import {
  IUser,
  IUserSettings,
  INotificationSummaryResponse,
  INotificationSummarySection,
  NotificationType,
} from '../types.js';

type ClubPendingSummary = {
  _id: Types.ObjectId;
  name: string;
  pendingCount: number;
  pendingMembers: Array<{
    joinedAt?: Date | null;
  }>;
  firstPendingUsername?: string | null;
  firstPendingAvatar?: string | null;
};

type NotificationListItem = {
  id: string;
  label: string;
  /** Optional secondary line (stored notifications only). */
  body?: string;
  count: number;
  isRead: boolean;
  createdAt: string;
  type: NotificationType | 'club_join_requests';
  /** Route the client should navigate to. Derived items fall back client-side. */
  link?: string;
  /** Image override (media cover, club icon…). */
  image?: string;
  meta: Record<string, string>;
};

type NotificationListResponse = {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  items: NotificationListItem[];
};

type DismissedClubDates = Record<string, Date>;

function normalizeDismissedClubDates(
  dismissedNotificationClubAt?: Record<string, string | Date> | null
): DismissedClubDates {
  return Object.fromEntries(
    Object.entries(dismissedNotificationClubAt ?? {}).map(([clubId, value]) => [
      clubId,
      new Date(value),
    ])
  );
}

async function getLatestChangelogNotificationItem(
  lastSeenChangelogAt?: Date | null
): Promise<NotificationListItem | null> {
  const latest = await Changelog.findOne({ published: true })
    .sort({ date: -1 })
    .select('_id version title date')
    .lean();

  if (!latest) {
    return null;
  }

  const latestDate = new Date(latest.date);

  if (lastSeenChangelogAt) {
    // Compare using the document's actual creation time (encoded in the
    // ObjectId) rather than its display date. The display date is stored as
    // UTC midnight which causes off-by-one day issues for users in negative
    // UTC offset timezones (e.g. UTC-4: local June 11 = UTC June 12 00:xx,
    // so markAsRead lands on "UTC June 12" while the changelog date is
    // "UTC June 11" and gets wrongly suppressed).
    const createdAt = latest._id.getTimestamp();
    if (createdAt <= new Date(lastSeenChangelogAt)) {
      return null;
    }
  }


  return {
    id: latest._id.toString(),
    label: `Version ${latest.version} is now available`,
    count: 1,
    isRead: false,
    type: 'changelog',
    createdAt: latestDate.toISOString(),
    meta: {
      changelogId: latest._id.toString(),
      version: latest.version,
      title: latest.title,
    },
  };
}

async function getDismissedClubDates(
  user: IUser | null | undefined
): Promise<DismissedClubDates> {
  if (!user) {
    return {};
  }

  user.settings = user.settings ?? ({} as IUserSettings);
  const settings = user.settings;
  const dismissedClubDates = normalizeDismissedClubDates(
    settings.dismissedNotificationClubAt
  );
  const legacyDismissedClubIds = settings.dismissedNotificationClubIds ?? [];

  if (legacyDismissedClubIds.length === 0) {
    return dismissedClubDates;
  }

  const migratedAt = new Date();

  for (const clubId of legacyDismissedClubIds) {
    if (!dismissedClubDates[clubId]) {
      dismissedClubDates[clubId] = migratedAt;
    }
  }

  try {
    settings.dismissedNotificationClubAt = dismissedClubDates;
    settings.dismissedNotificationClubIds = [];
    await user.save();
  } catch (err) {
    console.error('Failed to migrate dismissed club dates:', err);
  }

  return dismissedClubDates;
}

function buildClubNotificationItems(
  clubsWithPending: ClubPendingSummary[],
  lastViewedAt?: Date | null,
  dismissedClubDates: DismissedClubDates = {}
): NotificationListItem[] {
  return clubsWithPending
    .filter((club) => {
      const dismissedAt = dismissedClubDates[club._id.toString()];

      if (!dismissedAt) {
        return true;
      }

      const latestPendingAt = club.pendingMembers.reduce<Date | null>(
        (latest, member) => {
          if (!member.joinedAt) {
            return latest;
          }

          if (!latest || member.joinedAt > latest) {
            return member.joinedAt;
          }

          return latest;
        },
        null
      );

      if (!latestPendingAt) {
        return false;
      }

      return latestPendingAt > dismissedAt;
    })
    .map((club) => {
      const latestPendingAt = club.pendingMembers.reduce<Date | null>(
        (latest, member) => {
          if (!member.joinedAt) {
            return latest;
          }

          if (!latest || member.joinedAt > latest) {
            return member.joinedAt;
          }

          return latest;
        },
        null
      );

      const isRead = Boolean(
        lastViewedAt && latestPendingAt && latestPendingAt <= lastViewedAt
      );

      return {
        id: club._id.toString(),
        label:
          club.pendingCount === 1 && club.firstPendingUsername
            ? `${club.firstPendingUsername} wants to join ${club.name}`
            : `You have new join requests in ${club.name}`,
        count: club.pendingCount,
        isRead,
        type: 'club_join_requests',
        createdAt: (latestPendingAt ?? new Date()).toISOString(),
        meta: {
          clubId: club._id.toString(),
          ...(club.firstPendingUsername
            ? { username: club.firstPendingUsername }
            : {}),
          ...(club.firstPendingAvatar
            ? { avatar: club.firstPendingAvatar }
            : {}),
        },
      } satisfies NotificationListItem;
    })
    .sort((left, right) => {
      if (left.isRead !== right.isRead) {
        return Number(left.isRead) - Number(right.isRead);
      }

      return (
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );
    });
}

async function getClubPendingSummaries(
  leaderId: Types.ObjectId
): Promise<ClubPendingSummary[]> {
  return Club.aggregate<ClubPendingSummary>([
    {
      $match: {
        isActive: true,
        members: {
          $elemMatch: {
            user: leaderId,
            role: 'leader',
            status: 'active',
          },
        },
      },
    },
    {
      $addFields: {
        pendingMembers: {
          $filter: {
            input: '$members',
            as: 'member',
            cond: { $eq: ['$$member.status', 'pending'] },
          },
        },
      },
    },
    {
      $addFields: {
        pendingCount: { $size: '$pendingMembers' },
        firstPendingUserId: {
          $arrayElemAt: ['$pendingMembers.user', 0],
        },
      },
    },
    {
      $match: {
        pendingCount: { $gt: 0 },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'firstPendingUserId',
        foreignField: '_id',
        as: 'firstPendingUser',
        pipeline: [{ $project: { username: 1, avatar: 1 } }],
      },
    },
    {
      $addFields: {
        firstPendingUsername: {
          $arrayElemAt: ['$firstPendingUser.username', 0],
        },
        firstPendingAvatar: {
          $arrayElemAt: ['$firstPendingUser.avatar', 0],
        },
      },
    },
    {
      $project: {
        name: 1,
        pendingCount: 1,
        pendingMembers: 1,
        firstPendingUsername: 1,
        firstPendingAvatar: 1,
      },
    },
    {
      $sort: { pendingCount: -1, name: 1 },
    },
  ]);
}

type PopulatedActor = {
  _id: Types.ObjectId;
  username?: string;
  avatar?: string;
};

/**
 * Stored notifications (the generic system). Anything emitted through
 * `services/notifications.service.ts` shows up here without controller changes.
 */
async function getStoredNotificationItems(
  recipient: Types.ObjectId,
  { limit, unreadOnly = false }: { limit: number; unreadOnly?: boolean }
): Promise<NotificationListItem[]> {
  const query: Record<string, unknown> = { recipient };
  if (unreadOnly) {
    query.isRead = false;
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate<{ actor: PopulatedActor | null }>('actor', 'username avatar')
    .lean();

  return notifications.map((notification) => {
    const actor = notification.actor;
    const meta: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(
          (notification.meta as unknown as Record<string, string>) ?? {}
        )
      ),
    };

    if (actor?.username) meta.username = actor.username;
    if (actor?.avatar) meta.avatar = actor.avatar;
    if (notification.entityId) meta.entityId = notification.entityId;
    if (notification.entityType) meta.entityType = notification.entityType;

    return {
      id: notification._id.toString(),
      label: notification.title,
      ...(notification.body ? { body: notification.body } : {}),
      count: notification.count ?? 1,
      isRead: Boolean(notification.isRead),
      createdAt: new Date(notification.createdAt).toISOString(),
      type: notification.type,
      ...(notification.link ? { link: notification.link } : {}),
      ...(notification.image ? { image: notification.image } : {}),
      meta,
    } satisfies NotificationListItem;
  });
}

function sortByUnreadThenDate(
  left: NotificationListItem,
  right: NotificationListItem
): number {
  if (left.isRead !== right.isRead) {
    return Number(left.isRead) - Number(right.isRead);
  }

  return (
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

export async function getNotificationSummary(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<Response<INotificationSummaryResponse> | void> {
  try {
    const userId = res.locals.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const dismissedClubDates = await getDismissedClubDates(res.locals.user);
    const leaderId = Types.ObjectId.createFromHexString(userId.toString());
    const lastViewedAt = res.locals.user?.settings?.notificationsLastViewedAt;
    const lastSeenChangelogAt = res.locals.user?.settings?.lastSeenChangelogAt;
    const clubsWithPending = await getClubPendingSummaries(leaderId);
    const items = buildClubNotificationItems(
      clubsWithPending,
      lastViewedAt,
      dismissedClubDates
    );
    const unreadItems = items.filter((item) => !item.isRead);

    const sections: INotificationSummarySection[] = [];

    if (unreadItems.length > 0) {
      sections.push({
        type: 'club_join_requests',
        title: 'Join Requests',
        items: unreadItems,
      });
    }

    const storedUnread = await getStoredNotificationItems(leaderId, {
      limit: 10,
      unreadOnly: true,
    });

    if (storedUnread.length > 0) {
      sections.push({
        type: 'activity',
        title: 'Activity',
        items: storedUnread,
      });
    }

    const changelogItem =
      await getLatestChangelogNotificationItem(lastSeenChangelogAt);
    if (changelogItem) {
      sections.push({
        type: 'changelog',
        title: 'New Update',
        items: [changelogItem],
      });
    }

    const storedUnreadCount = await Notification.countDocuments({
      recipient: leaderId,
      isRead: false,
    });

    const totalCount =
      unreadItems.reduce((sum, item) => sum + item.count, 0) +
      storedUnreadCount +
      (changelogItem ? 1 : 0);

    return res.status(200).json({ totalCount, sections });
  } catch (error) {
    return next(error as customError);
  }
}

export async function markNotificationsAsRead(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const user = res.locals.user;

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    user.settings = user.settings ?? {};
    user.settings.notificationsLastViewedAt = new Date();
    user.settings.lastSeenChangelogAt = new Date();
    await user.save();

    await Notification.updateMany(
      { recipient: user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return res.sendStatus(204);
  } catch (error) {
    return next(error as customError);
  }
}

export async function markNotificationsAsUnread(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const user = res.locals.user;

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    user.settings = user.settings ?? {};
    user.settings.notificationsLastViewedAt = null;
    user.settings.lastSeenChangelogAt = null;
    await user.save();

    await Notification.updateMany(
      { recipient: user._id },
      { $set: { isRead: false, readAt: null } }
    );

    return res.sendStatus(204);
  } catch (error) {
    return next(error as customError);
  }
}

export async function deleteNotification(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    const user = res.locals.user;

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const notificationId = req.params.id?.trim();
    if (!notificationId) {
      return res.status(400).json({ message: 'Notification id is required' });
    }

    user.settings = user.settings ?? {};

    // Stored notifications own their id, so try them first.
    if (Types.ObjectId.isValid(notificationId)) {
      const deleted = await Notification.findOneAndDelete({
        _id: notificationId,
        recipient: user._id,
      });

      if (deleted) {
        return res.sendStatus(204);
      }
    }

    // Check if this is a changelog notification dismissal
    const matchedChangelog = await Changelog.findOne({
      _id: notificationId,
      published: true,
    })
      .select('_id')
      .lean();

    if (matchedChangelog) {
      user.settings.lastSeenChangelogAt = new Date();
      await user.save();
      return res.sendStatus(204);
    }

    // Otherwise treat it as a club notification dismissal
    const dismissedClubDates = normalizeDismissedClubDates(
      user.settings.dismissedNotificationClubAt
    );
    dismissedClubDates[notificationId] = new Date();
    user.settings.dismissedNotificationClubAt = dismissedClubDates;
    user.settings.dismissedNotificationClubIds = [];
    await user.save();

    return res.sendStatus(204);
  } catch (error) {
    return next(error as customError);
  }
}

export async function getNotificationList(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response<NotificationListResponse> | void> {
  try {
    const userId = res.locals.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number(req.query.limit ?? 15) || 15)
    );
    const skip = (page - 1) * limit;
    const leaderId = new Types.ObjectId(userId.toString());
    const lastViewedAt = res.locals.user?.settings?.notificationsLastViewedAt;
    const lastSeenChangelogAt = res.locals.user?.settings?.lastSeenChangelogAt;
    const dismissedClubDates = await getDismissedClubDates(res.locals.user);

    const clubsWithPending = await getClubPendingSummaries(leaderId);
    const clubItems = buildClubNotificationItems(
      clubsWithPending,
      lastViewedAt,
      dismissedClubDates
    );

    const changelogItem =
      await getLatestChangelogNotificationItem(lastSeenChangelogAt);

    // Derived items (club requests + changelog) are few, so they are merged
    // in full with the current window of stored notifications and re-sorted.
    const storedTotal = await Notification.countDocuments({
      recipient: leaderId,
    });
    const storedItems = await getStoredNotificationItems(leaderId, {
      limit: skip + limit,
    });

    const derivedItems: NotificationListItem[] = [
      ...(changelogItem ? [changelogItem] : []),
      ...clubItems,
    ];

    const items = [...derivedItems, ...storedItems].sort(sortByUnreadThenDate);

    const total = derivedItems.length + storedTotal;
    const paginatedItems = items.slice(skip, skip + limit);

    return res.status(200).json({
      total,
      page,
      limit,
      hasMore: skip + limit < total,
      items: paginatedItems,
    });
  } catch (error) {
    return next(error as customError);
  }
}
