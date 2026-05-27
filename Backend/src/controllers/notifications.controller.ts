import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Club } from '../models/club.model.js';
import { customError } from '../middlewares/errorMiddleware.js';
import {
  IUser,
  IUserSettings,
  INotificationSummaryResponse,
  INotificationSummarySection,
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
  count: number;
  isRead: boolean;
  createdAt: string;
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
    const leaderId = new Types.ObjectId(userId.toString());
    const lastViewedAt = res.locals.user?.settings?.notificationsLastViewedAt;
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

    const totalCount = unreadItems.reduce((sum, item) => sum + item.count, 0);

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
    await user.save();

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
    await user.save();

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
    const dismissedClubDates = await getDismissedClubDates(res.locals.user);

    const clubsWithPending = await getClubPendingSummaries(leaderId);
    const items = buildClubNotificationItems(
      clubsWithPending,
      lastViewedAt,
      dismissedClubDates
    );
    const total = items.length;
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
