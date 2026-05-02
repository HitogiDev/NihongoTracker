import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Club } from '../models/club.model.js';
import { customError } from '../middlewares/errorMiddleware.js';
import {
  INotificationSummaryResponse,
  INotificationSummarySection,
} from '../types.js';

type ClubPendingSummary = {
  _id: Types.ObjectId;
  name: string;
  pendingCount: number;
  firstPendingUsername?: string | null;
  firstPendingAvatar?: string | null;
};

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
    const leaderId = new Types.ObjectId(userId.toString());

    const clubsWithPending = await Club.aggregate<ClubPendingSummary>([
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
          firstPendingUsername: 1,
          firstPendingAvatar: 1,
        },
      },
      {
        $sort: { pendingCount: -1, name: 1 },
      },
    ]);

    const joinRequestItems = clubsWithPending.map((club) => {
      const meta: Record<string, string> = { clubId: club._id.toString() };
      if (club.firstPendingUsername) {
        meta.username = club.firstPendingUsername;
      }
      if (club.firstPendingAvatar) {
        meta.avatar = club.firstPendingAvatar;
      }

      return {
        id: club._id.toString(),
        label:
          club.pendingCount === 1 && club.firstPendingUsername
            ? `${club.firstPendingUsername} wants to join ${club.name}`
            : `You have new join requests in ${club.name}`,
        count: club.pendingCount,
        meta,
      };
    });

    const sections: INotificationSummarySection[] = [];

    if (joinRequestItems.length > 0) {
      sections.push({
        type: 'club_join_requests',
        title: 'Join Requests',
        items: joinRequestItems,
      });
    }

    const totalCount = joinRequestItems.reduce(
      (sum, item) => sum + item.count,
      0
    );

    return res.status(200).json({ totalCount, sections });
  } catch (error) {
    return next(error as customError);
  }
}
