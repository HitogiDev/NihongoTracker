import User from '../models/user.model.js';
import Log from '../models/log.model.js';
import { Request, Response, NextFunction } from 'express';
import { IUser } from '../types.js';
import { customError } from '../middlewares/errorMiddleware.js';
import { deleteFile } from '../services/uploadFile.js';
import bcrypt from 'bcryptjs';
import { checkPatreonMembershipForUser } from '../controllers/patreon.controller.js';

export async function getAdminStats(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const [totalUsers, totalLogs] = await Promise.all([
      User.countDocuments(),
      Log.countDocuments(),
    ]);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeUsers = await Log.distinct('user', {
      createdAt: { $gte: thirtyDaysAgo },
    }).then((userIds) => userIds.length);

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsersThisWeek = await User.countDocuments({
      createdAt: { $gte: oneWeekAgo },
    });

    const [totalUserXpAgg, totalMinutesAgg] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: null,
            totalXp: { $sum: '$stats.userXp' },
          },
        },
      ]),
      Log.aggregate([
        {
          $group: {
            _id: null,
            totalMinutes: { $sum: { $ifNull: ['$time', 0] } },
          },
        },
      ]),
    ]);

    const dbStats = await User.db.db?.stats();
    const dbDataSizeBytes = dbStats?.dataSize || 0;
    const dbStorageSizeBytes = dbStats?.storageSize || 0;
    const dbIndexSizeBytes = dbStats?.indexSize || 0;
    const dbTotalSizeBytes = dbStorageSizeBytes + dbIndexSizeBytes;

    const topUsers = await User.find()
      .sort({ 'stats.userXp': -1 })
      .limit(10)
      .select('username stats.userXp')
      .lean();

    const topUsersWithLogs = await Promise.all(
      topUsers.map(async (user) => {
        const [logsCount, minutesAgg] = await Promise.all([
          Log.countDocuments({ user: user._id }),
          Log.aggregate([
            { $match: { user: user._id } },
            {
              $group: {
                _id: null,
                totalMinutes: { $sum: { $ifNull: ['$time', 0] } },
              },
            },
          ]),
        ]);
        const totalMinutes = minutesAgg[0]?.totalMinutes || 0;
        return {
          username: user.username,
          totalXp: user.stats?.userXp || 0,
          totalHours: totalMinutes / 60,
          logsCount,
        };
      })
    );

    const adminStats = {
      totalUsers,
      totalLogs,
      activeUsers,
      newUsersThisWeek,
      totalXp: totalUserXpAgg[0]?.totalXp || 0,
      totalHours: (totalMinutesAgg[0]?.totalMinutes || 0) / 60,
      topUsers: topUsersWithLogs.slice(0, 5),
      systemStats: {
        memoryUsage: process.memoryUsage().heapTotal
          ? (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) *
            100
          : 0,
        diskUsage: dbTotalSizeBytes,
        databaseSizeBytes: dbTotalSizeBytes,
        databaseDataSizeBytes: dbDataSizeBytes,
        databaseStorageSizeBytes: dbStorageSizeBytes,
        databaseIndexSizeBytes: dbIndexSizeBytes,
        uptime: process.uptime() / (24 * 60 * 60), // Convert seconds to days
      },
    };

    res.json(adminStats);
  } catch (error) {
    return next(error as customError);
  }
}

export async function getAdminUsers(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    const skip = (page - 1) * limit;

    // Build search query
    const searchQuery = search
      ? { username: { $regex: search, $options: 'i' } }
      : {};

    const [users, total] = await Promise.all([
      User.find(searchQuery)
        .select('username roles createdAt stats.userXp')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(searchQuery),
    ]);

    // Get last activity for each user
    const usersWithActivity = await Promise.all(
      users.map(async (user) => {
        const [lastLog, minutesAgg] = await Promise.all([
          Log.findOne({ user: user._id })
            .sort({ createdAt: -1 })
            .select({ createdAt: 1 })
            .lean(),
          Log.aggregate([
            { $match: { user: user._id } },
            {
              $group: {
                _id: null,
                totalMinutes: { $sum: { $ifNull: ['$time', 0] } },
              },
            },
          ]),
        ]);
        const totalMinutes = minutesAgg[0]?.totalMinutes || 0;
        const userHours = totalMinutes / 60;

        return {
          ...user,
          stats: { userXp: user.stats?.userXp || 0, userHours },
          lastActivity: (lastLog as any)?.createdAt || null,
        };
      })
    );

    res.json({
      users: usersWithActivity,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function deleteUserById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw new customError('User not found', 404);

    // Delete user's files from Firebase before deleting user
    if (user.avatar) {
      await deleteFile(user.avatar);
    }
    if (user.banner) {
      await deleteFile(user.banner);
    }

    // Delete the user and their logs
    await User.findByIdAndDelete(req.params.id);
    await Log.deleteMany({ user: req.params.id });

    return res.sendStatus(204);
  } catch (error) {
    return next(error as customError);
  }
}

export async function updateUserById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { username, password, clubs, stats, titles, roles, avatar, banner } =
    req.body as IUser;
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        avatar,
        banner,
        username,
        password,
        clubs,
        stats,
        titles,
        roles,
      },
      { new: true }
    );
    if (!updatedUser) throw new customError('User not found', 404);
    return res.json(updatedUser);
  } catch (error) {
    return next(error as customError);
  }
}

export async function resetUserPassword(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { newPassword } = req.body as { newPassword?: string };
    if (!newPassword || newPassword.length < 6) {
      throw new customError('Password must be at least 6 characters', 400);
    }
    const user = await User.findById(req.params.id);
    if (!user) throw new customError('User not found', 404);
    // Hash explicitly to avoid relying on pre-save for findByIdAndUpdate
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    return res.status(200).json({ message: 'Password updated' });
  } catch (error) {
    return next(error as customError);
  }
}

export async function searchAdminLogs(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const page = parseInt((req.query.page as string) || '1');
    const limit = Math.min(parseInt((req.query.limit as string) || '20'), 100);
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) || '';
    const type = (req.query.type as string) || '';
    const username = (req.query.username as string) || '';
    const start = req.query.start
      ? new Date(req.query.start as string)
      : undefined;
    const end = req.query.end ? new Date(req.query.end as string) : undefined;

    const matchStage: Record<string, unknown> = {};
    if (type) matchStage.type = type;
    if (start || end) {
      matchStage.date = {
        ...(start ? { $gte: start } : {}),
        ...(end ? { $lte: end } : {}),
      };
    }
    if (search) {
      matchStage.$or = [
        { description: { $regex: search, $options: 'i' } },
        { mediaTitle: { $regex: search, $options: 'i' } },
      ];
    }

    // If username provided, resolve to user _id first
    let userIdFilter: any = null;
    if (username) {
      const u = await User.findOne({ username }).select('_id').lean();
      if (!u) {
        return res.json({ logs: [], total: 0, page, totalPages: 0 });
      }
      userIdFilter = u._id;
      matchStage.user = userIdFilter;
    }

    const pipeline: any[] = [
      { $match: matchStage },
      { $sort: { date: -1 } },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userDoc',
              },
            },
            { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                user: 1,
                username: '$userDoc.username',
                type: 1,
                description: 1,
                episodes: 1,
                pages: 1,
                chars: 1,
                time: 1,
                xp: 1,
                date: 1,
                mediaTitle: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
          count: [{ $count: 'total' }],
        },
      },
      {
        $project: {
          items: 1,
          total: { $ifNull: [{ $arrayElemAt: ['$count.total', 0] }, 0] },
        },
      },
    ];

    const agg = await Log.aggregate(pipeline);
    const items = agg[0]?.items || [];
    const total = agg[0]?.total || 0;
    return res.json({
      logs: items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return next(error as customError);
  }
}

// Admin: manually grant or revoke a patreon tier for a user
export async function adminSetPatreonStatus(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { tier, days } = req.body as {
      tier: 'donator' | 'enthusiast' | 'consumer' | null;
      days?: number;
    };

    const user = await User.findById(req.params.id);
    if (!user) throw new customError('User not found', 404);

    if (!tier) {
      // Remove patreon status
      user.patreon = {
        ...user.patreon,
        tier: null,
        isActive: false,
        manualTierExpiry: undefined,
        lastChecked: new Date(),
      };
    } else {
      const expiry =
        days && days > 0
          ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
          : undefined;
      user.patreon = {
        ...user.patreon,
        tier,
        isActive: true,
        manualTierExpiry: expiry,
        lastChecked: new Date(),
      };
    }

    await user.save();

    return res.status(200).json({
      message: tier
        ? `Patreon tier "${tier}" granted${
            days ? ` for ${days} day(s)` : ' indefinitely'
          }`
        : 'Patreon status removed',
      patreon: {
        tier: user.patreon?.tier,
        isActive: user.patreon?.isActive,
        manualTierExpiry: user.patreon?.manualTierExpiry,
      },
    });
  } catch (error) {
    return next(error as customError);
  }
}

// Admin: sync Patreon membership for all linked users
export async function syncPatreonMembers(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Only users who completed OAuth (have a patreonId + tokens stored)
    const users = await User.find({
      'patreon.patreonId': { $exists: true, $ne: null },
    })
      .select('_id username')
      .lean();

    let checked = 0;
    let updated = 0;
    let failed = 0;

    for (const user of users) {
      const result = await checkPatreonMembershipForUser(user._id.toString());
      if (result === null) {
        failed++;
      } else {
        checked++;
        if (result.updated) updated++;
      }
    }

    return res.status(200).json({
      message: `Patreon sync complete: ${checked} checked, ${updated} updated, ${failed} skipped (no token)`,
      checked,
      updated,
      failed,
    });
  } catch (error) {
    return next(error as customError);
  }
}

// Get paid users statistics
export async function getPatronStats(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Count users by tier
    const [donatorCount, enthusiastCount, consumerCount] = await Promise.all([
      User.countDocuments({ 'patreon.tier': 'donator' }),
      User.countDocuments({ 'patreon.tier': 'enthusiast' }),
      User.countDocuments({ 'patreon.tier': 'consumer' }),
    ]);

    const totalPaidUsers = donatorCount + enthusiastCount + consumerCount;

    // Get all paid users
    const paidUsers = await User.find({
      'patreon.tier': { $in: ['donator', 'enthusiast', 'consumer'] },
    })
      .select('username patreon.tier stats.userXp createdAt')
      .sort({ 'stats.userXp': -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        total: totalPaidUsers,
        byTier: {
          donator: donatorCount,
          enthusiast: enthusiastCount,
          consumer: consumerCount,
        },
        users: paidUsers,
      },
    });
  } catch (error) {
    return next(error as customError);
  }
}
