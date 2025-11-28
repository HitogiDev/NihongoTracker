import User from '../models/user.model.js';
import Log from '../models/log.model.js';
import Tag from '../models/tag.model.js';
import { Request, Response, NextFunction } from 'express';
import { IMediaDocument, IUpdateRequest } from '../types.js';
import { customError } from '../middlewares/errorMiddleware.js';
import { deleteFile, uploadFileWithCleanup } from '../services/uploadFile.js';
import axios from 'axios';
import crypto from 'crypto';
import { sendVerificationEmail } from '../mailtrap/emails.js';

export async function updateUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const {
    username,
    email,
    newPassword,
    newPasswordConfirm,
    password,
    discordId,
    blurAdultContent,
    hideUnmatchedLogsAlert,
    timezone,
  } = req.body as IUpdateRequest;

  try {
    const user = await User.findById(res.locals.user._id);
    if (!user) {
      throw new customError('User not found', 404);
    }

    if (newPassword || newPasswordConfirm) {
      if (!password) {
        throw new customError('Old password is required', 400);
      }
      if (!newPassword) {
        throw new customError('New password is required', 400);
      }
      if (!newPasswordConfirm) {
        throw new customError('You need to confirm the new password', 400);
      }
      if (newPassword !== newPasswordConfirm) {
        throw new customError('Passwords do not match', 403);
      }
      if (!(await user.matchPassword(password))) {
        throw new customError('Incorrect password', 401);
      }

      user.password = newPassword;
    }

    if (username) {
      if (!username.match(/^[a-zA-Z0-9_]*$/)) {
        throw new customError(
          'Username can only contain letters, numbers and underscores',
          400
        );
      }
      if (username.length < 1 || username.length > 20) {
        throw new customError(
          'Username must be between 1 and 20 characters',
          400
        );
      }
      if (await User.findOne({ username })) {
        throw new customError('Username already taken', 400);
      }
      if (!password) {
        throw new customError('Password is required', 400);
      }
      if (!(await user.matchPassword(password))) {
        throw new customError('Incorrect password', 401);
      }

      if (user.username !== username) user.username = username;
    }

    if (email !== undefined) {
      // Allow empty string to remove email
      if (email === '') {
        user.email = undefined;
        user.verified = false;
      } else {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw new customError('Invalid email format', 400);
        }

        // Check if email is already in use by another user
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (
          existingUser &&
          existingUser._id.toString() !== user._id.toString()
        ) {
          throw new customError('Email already in use', 400);
        }

        if (!password) {
          throw new customError('Password is required', 400);
        }
        if (!(await user.matchPassword(password))) {
          throw new customError('Incorrect password', 401);
        }

        // If email is being changed, mark as unverified
        if (user.email !== email.toLowerCase()) {
          user.email = email.toLowerCase();
          user.verified = false;

          // Generate verification token
          const verificationToken = crypto.randomBytes(32).toString('hex');
          user.verificationToken = verificationToken;
          user.verificationTokenExpiry = new Date(
            Date.now() + 24 * 60 * 60 * 1000
          ); // 24 hours
          user.lastVerificationEmailSent = new Date();
        }
      }
    }

    if (req.files && Object.keys(req.files).length > 0) {
      try {
        const files = req.files as {
          [fieldname: string]: Express.Multer.File[];
        };

        if (files.avatar?.[0]) {
          const file = await uploadFileWithCleanup(
            files.avatar[0],
            user.avatar
          );
          user.avatar = file.downloadURL;
        }

        if (files.banner?.[0]) {
          const file = await uploadFileWithCleanup(
            files.banner[0],
            user.banner
          );
          user.banner = file.downloadURL;
        }

        if (!files.avatar && !files.banner) {
          throw new customError(
            'Invalid field name. Only avatar and banner uploads are allowed.',
            400
          );
        }
      } catch (error) {
        if (error instanceof customError) {
          return next(error);
        }
        return next(
          new customError(
            'File upload failed: ' + (error as Error).message,
            400
          )
        );
      }
    }

    if (discordId) {
      if (!discordId.match(/^\d{17,19}$/)) {
        throw new customError('Invalid Discord ID format', 400);
      }
      const existingUser = await User.findOne({ discordId });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        throw new customError('Discord ID already linked to another user', 400);
      }
      user.discordId = discordId;
    }

    if (
      blurAdultContent !== undefined ||
      hideUnmatchedLogsAlert !== undefined ||
      timezone !== undefined
    ) {
      const updatedSettings: any = { ...user.settings };

      if (blurAdultContent !== undefined) {
        updatedSettings.blurAdultContent = blurAdultContent === 'true';
      }

      if (hideUnmatchedLogsAlert !== undefined) {
        updatedSettings.hideUnmatchedLogsAlert =
          hideUnmatchedLogsAlert === 'true';
      }

      if (timezone !== undefined) {
        // Validate timezone
        try {
          Intl.DateTimeFormat(undefined, { timeZone: timezone });
          updatedSettings.timezone = timezone;
        } catch (error) {
          throw new customError('Invalid timezone', 400);
        }
      }
      user.settings = updatedSettings;
    }

    const updatedUser = await user.save();

    // Send verification email if email was changed
    if (
      email !== undefined &&
      email !== '' &&
      updatedUser.email &&
      !updatedUser.verified &&
      updatedUser.verificationToken
    ) {
      try {
        await sendVerificationEmail(
          updatedUser.email,
          updatedUser.verificationToken
        );
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't throw error - user update should still succeed
      }
    }

    return res.status(200).json({
      _id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      verified: updatedUser.verified,
      discordId: updatedUser.discordId,
      stats: updatedUser.stats,
      avatar: updatedUser.avatar,
      banner: updatedUser.banner,
      titles: updatedUser.titles,
      roles: updatedUser.roles,
      settings: updatedUser.settings,
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  const userFound = await User.findOne({
    username: req.params.username,
  }).collation({ locale: 'en', strength: 2 });
  if (!userFound) return next(new customError('User not found', 404));

  return res.json({
    id: userFound._id,
    username: userFound.username,
    stats: userFound.stats,
    discordId: userFound.discordId,
    avatar: userFound.avatar,
    banner: userFound.banner,
    titles: userFound.titles,
    patreon: userFound.patreon,
    settings: userFound.settings,
    createdAt: userFound.createdAt,
    updatedAt: userFound.updatedAt,
  });
}

export async function getRanking(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const filter = (req.query.filter as string) || 'userLevel';
    const sort = (req.query.sort as string) || 'desc';
    const timeFilter = (req.query.timeFilter as string) || 'all-time';
    const timezone = (req.query.timezone as string) || 'UTC'; // Accept timezone as query parameter
    const startParam = (req.query.start as string) || undefined; // YYYY-MM-DD
    const endParam = (req.query.end as string) || undefined; // YYYY-MM-DD

    // Create date filter based on timeFilter using the provided timezone
    let dateFilter: { date?: { $gte?: Date; $lt?: Date } } = {};
    const now = new Date();

    // Get current date in the specified timezone
    const userDate = new Date(
      now.toLocaleString('en-US', { timeZone: timezone })
    );
    const offsetNow = now.getTime() - userDate.getTime();

    if (startParam || endParam) {
      // Custom range overrides timeFilter
      const makeLocal = (s: string) => new Date(`${s}T00:00:00`);
      if (startParam) {
        const startLocal = makeLocal(startParam);
        const startUTC = new Date(startLocal.getTime() + offsetNow);
        dateFilter.date = { ...(dateFilter.date || {}), $gte: startUTC };
      }
      if (endParam) {
        const endLocal = makeLocal(endParam);
        // add 1 day to include the whole end day
        const endLocalPlus = new Date(endLocal.getTime());
        endLocalPlus.setDate(endLocalPlus.getDate() + 1);
        const endUTC = new Date(endLocalPlus.getTime() + offsetNow);
        dateFilter.date = { ...(dateFilter.date || {}), $lt: endUTC };
      }
    } else if (timeFilter === 'today') {
      const startOfDayLocal = new Date(
        userDate.getFullYear(),
        userDate.getMonth(),
        userDate.getDate()
      );
      const startOfDay = new Date(startOfDayLocal.getTime() + offsetNow);
      dateFilter = { date: { $gte: startOfDay } };
    } else if (timeFilter === 'week') {
      const startOfWeekLocal = new Date(
        userDate.getFullYear(),
        userDate.getMonth(),
        userDate.getDate() - userDate.getDay()
      );
      const startOfWeek = new Date(startOfWeekLocal.getTime() + offsetNow);
      dateFilter = { date: { $gte: startOfWeek } };
    } else if (timeFilter === 'month') {
      const startOfMonthLocal = new Date(
        userDate.getFullYear(),
        userDate.getMonth(),
        1
      );
      const startOfMonth = new Date(startOfMonthLocal.getTime() + offsetNow);
      dateFilter = { date: { $gte: startOfMonth } };
    } else if (timeFilter === 'year') {
      const startOfYearLocal = new Date(userDate.getFullYear(), 0, 1);
      const startOfYear = new Date(startOfYearLocal.getTime() + offsetNow);
      dateFilter = { date: { $gte: startOfYear } };
    }

    // Extract date values for use in aggregation
    const dateGte = dateFilter.date?.$gte;
    const dateLt = dateFilter.date?.$lt;

    // If filtering by time period or custom range, calculate stats from logs
    if (timeFilter !== 'all-time' || startParam || endParam) {
      // Lookup user details with aggregated stats
      const rankingUsers = await User.aggregate([
        {
          $lookup: {
            from: 'logs',
            let: { userId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$user', '$$userId'] },
                      ...(dateGte ? [{ $gte: ['$date', dateGte] }] : []),
                      ...(dateLt ? [{ $lt: ['$date', dateLt] }] : []),
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: '$user',
                  userXp: { $sum: '$xp' },
                  totalChars: { $sum: { $ifNull: ['$chars', 0] } },
                  readingXp: {
                    $sum: {
                      $cond: [
                        { $in: ['$type', ['reading', 'manga', 'vn']] },
                        '$xp',
                        0,
                      ],
                    },
                  },
                  listeningXp: {
                    $sum: {
                      $cond: [
                        { $in: ['$type', ['anime', 'audio', 'video']] },
                        '$xp',
                        0,
                      ],
                    },
                  },
                  // Calculate total minutes from all activities
                  totalMinutes: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            { $eq: ['$type', 'anime'] },
                            {
                              $or: [
                                { $eq: ['$time', 0] },
                                { $eq: ['$time', null] },
                                { $eq: [{ $type: '$time' }, 'missing'] },
                              ],
                            },
                            { $gt: ['$episodes', 0] },
                          ],
                        },
                        { $multiply: ['$episodes', 24] }, // 24 minutes per episode
                        { $ifNull: ['$time', 0] }, // Use actual time or 0 if null
                      ],
                    },
                  },
                  readingMinutes: {
                    $sum: {
                      $cond: [
                        { $in: ['$type', ['reading', 'manga', 'vn']] },
                        { $ifNull: ['$time', 0] },
                        0,
                      ],
                    },
                  },
                  listeningMinutes: {
                    $sum: {
                      $cond: [
                        {
                          $in: ['$type', ['anime', 'audio', 'video', 'movie']],
                        },
                        {
                          $cond: [
                            {
                              $and: [
                                { $eq: ['$type', 'anime'] },
                                {
                                  $or: [
                                    { $eq: ['$time', 0] },
                                    { $eq: ['$time', null] },
                                    { $eq: [{ $type: '$time' }, 'missing'] },
                                  ],
                                },
                                { $gt: ['$episodes', 0] },
                              ],
                            },
                            { $multiply: ['$episodes', 24] }, // 24 minutes per episode
                            { $ifNull: ['$time', 0] }, // Use actual time or 0 if null
                          ],
                        },
                        0,
                      ],
                    },
                  },
                },
              },
              {
                $addFields: {
                  userHours: {
                    $round: [{ $divide: ['$totalMinutes', 60] }, 1],
                  },
                  readingHours: {
                    $round: [{ $divide: ['$readingMinutes', 60] }, 1],
                  },
                  listeningHours: {
                    $round: [{ $divide: ['$listeningMinutes', 60] }, 1],
                  },
                },
              },
            ],
            as: 'timeStats',
          },
        },
        // Unwind the timeStats array - this will exclude users with no logs in the time period
        { $unwind: { path: '$timeStats', preserveNullAndEmptyArrays: false } },
        {
          $project: {
            _id: 0,
            username: 1,
            avatar: 1,
            patreon: {
              isActive: '$patreon.isActive',
              tier: '$patreon.tier',
              customBadgeText: '$patreon.customBadgeText',
              badgeColor: '$patreon.badgeColor',
              badgeTextColor: '$patreon.badgeTextColor',
            },
            stats: {
              userXp: '$timeStats.userXp',
              userChars: '$timeStats.totalChars',
              readingXp: '$timeStats.readingXp',
              listeningXp: '$timeStats.listeningXp',
              userLevel: 1, // Keep the user level from the user document
              // Use hours calculated directly from time field
              userHours: '$timeStats.userHours',
              readingHours: '$timeStats.readingHours',
              listeningHours: '$timeStats.listeningHours',
            },
          },
        },
        // Filter out users with 0 value for the selected metric
        {
          $match: {
            [`stats.${filter}`]: { $gt: 0 },
          },
        },
        { $sort: { [`stats.${filter}`]: sort === 'asc' ? 1 : -1 } },
        { $skip: skip },
        { $limit: limit },
      ]);
      return res.status(200).json(rankingUsers);
    } else {
      // Default behavior - get all-time stats with hours calculated from logs
      const rankingUsers = await User.aggregate([
        {
          $lookup: {
            from: 'logs',
            let: { userId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$user', '$$userId'] },
                },
              },
              {
                $group: {
                  _id: '$user',
                  totalMinutes: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            { $eq: ['$type', 'anime'] },
                            {
                              $or: [
                                { $eq: ['$time', 0] },
                                { $eq: ['$time', null] },
                                { $eq: [{ $type: '$time' }, 'missing'] },
                              ],
                            },
                            { $gt: ['$episodes', 0] },
                          ],
                        },
                        { $multiply: ['$episodes', 24] }, // 24 minutes per episode
                        { $ifNull: ['$time', 0] }, // Use actual time or 0 if null
                      ],
                    },
                  },
                  totalChars: { $sum: { $ifNull: ['$chars', 0] } },
                  readingMinutes: {
                    $sum: {
                      $cond: [
                        { $in: ['$type', ['reading', 'manga', 'vn']] },
                        { $ifNull: ['$time', 0] },
                        0,
                      ],
                    },
                  },
                  listeningMinutes: {
                    $sum: {
                      $cond: [
                        {
                          $in: ['$type', ['anime', 'audio', 'video', 'movie']],
                        },
                        {
                          $cond: [
                            {
                              $and: [
                                { $eq: ['$type', 'anime'] },
                                {
                                  $or: [
                                    { $eq: ['$time', 0] },
                                    { $eq: ['$time', null] },
                                    { $eq: [{ $type: '$time' }, 'missing'] },
                                  ],
                                },
                                { $gt: ['$episodes', 0] },
                              ],
                            },
                            { $multiply: ['$episodes', 24] }, // 24 minutes per episode
                            { $ifNull: ['$time', 0] }, // Use actual time or 0 if null
                          ],
                        },
                        0,
                      ],
                    },
                  },
                },
              },
              {
                $addFields: {
                  totalHours: {
                    $round: [{ $divide: ['$totalMinutes', 60] }, 1],
                  },
                  readingHours: {
                    $round: [{ $divide: ['$readingMinutes', 60] }, 1],
                  },
                  listeningHours: {
                    $round: [{ $divide: ['$listeningMinutes', 60] }, 1],
                  },
                  chars: '$totalChars',
                },
              },
            ],
            as: 'timeData',
          },
        },
        {
          $addFields: {
            'stats.userHours': {
              $ifNull: [{ $arrayElemAt: ['$timeData.totalHours', 0] }, 0],
            },
            'stats.readingHours': {
              $ifNull: [{ $arrayElemAt: ['$timeData.readingHours', 0] }, 0],
            },
            'stats.listeningHours': {
              $ifNull: [{ $arrayElemAt: ['$timeData.listeningHours', 0] }, 0],
            },
            'stats.userChars': {
              $ifNull: [{ $arrayElemAt: ['$timeData.chars', 0] }, 0],
            },
          },
        },
        // Filter out users with 0 value for the selected metric
        {
          $match: {
            [`stats.${filter}`]: { $gt: 0 },
          },
        },
        { $sort: { [`stats.${filter}`]: sort === 'asc' ? 1 : -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            avatar: 1,
            username: 1,
            stats: 1,
            patreon: {
              isActive: '$patreon.isActive',
              tier: '$patreon.tier',
              customBadgeText: '$patreon.customBadgeText',
              badgeColor: '$patreon.badgeColor',
              badgeTextColor: '$patreon.badgeTextColor',
            },
          },
        },
      ]);

      return res.status(200).json(rankingUsers);
    }
  } catch (error) {
    return next(error as customError);
  }
}

export async function getRankingSummary(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const getMonthBoundaries = (timezone: string) => {
    const now = new Date();
    let userNow: Date;
    try {
      userNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    } catch (error) {
      userNow = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    }

    const offset = now.getTime() - userNow.getTime();
    const monthStartLocal = new Date(
      userNow.getFullYear(),
      userNow.getMonth(),
      1
    );
    const nextMonthLocal = new Date(
      userNow.getFullYear(),
      userNow.getMonth() + 1,
      1
    );

    return {
      monthStart: new Date(monthStartLocal.getTime() + offset),
      monthEnd: new Date(nextMonthLocal.getTime() + offset),
    };
  };

  try {
    const { username } = req.params;
    const timezoneParam = (req.query.timezone as string) || undefined;

    const userDoc = await User.findOne({ username })
      .select('username stats settings.timezone')
      .lean();

    if (!userDoc || !userDoc.stats) {
      throw new customError('User not found', 404);
    }

    const timezone = timezoneParam || userDoc.settings?.timezone || 'UTC';

    const userXp = userDoc.stats.userXp ?? 0;

    const higherCount = await User.countDocuments({
      'stats.userXp': { $gt: userXp },
    });

    const nextUser = await User.findOne({
      'stats.userXp': { $gt: userXp },
    })
      .sort({ 'stats.userXp': 1 })
      .select('username stats.userXp')
      .lean();

    const totalUsers = await User.countDocuments({});

    const { monthStart, monthEnd } = getMonthBoundaries(timezone);

    const monthlyUserResult = await Log.aggregate([
      {
        $match: {
          user: userDoc._id,
          date: {
            $gte: monthStart,
            $lt: monthEnd,
          },
        },
      },
      {
        $group: {
          _id: '$user',
          xp: { $sum: '$xp' },
        },
      },
    ]);

    const userMonthlyXp = monthlyUserResult[0]?.xp ?? 0;

    const [monthlyAggregate] = await Log.aggregate([
      {
        $match: {
          date: {
            $gte: monthStart,
            $lt: monthEnd,
          },
        },
      },
      {
        $group: {
          _id: '$user',
          xp: { $sum: '$xp' },
        },
      },
      {
        $facet: {
          ahead: [
            { $match: { xp: { $gt: userMonthlyXp } } },
            { $count: 'count' },
          ],
          total: [{ $match: { xp: { $gt: 0 } } }, { $count: 'count' }],
          nextUser: [
            { $match: { xp: { $gt: userMonthlyXp } } },
            { $sort: { xp: 1 } },
            { $limit: 1 },
            {
              $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'user',
              },
            },
            {
              $unwind: {
                path: '$user',
                preserveNullAndEmptyArrays: false,
              },
            },
            {
              $project: {
                username: '$user.username',
                xp: 1,
              },
            },
          ],
        },
      },
    ]);

    const aheadCount = monthlyAggregate?.ahead?.[0]?.count ?? 0;
    const participantCount = monthlyAggregate?.total?.[0]?.count ?? 0;
    const nextMonthlyUser = monthlyAggregate?.nextUser?.[0] ?? null;

    let monthlyTotalUsers = participantCount;
    if (monthlyTotalUsers === 0) {
      monthlyTotalUsers = 1;
    } else if (userMonthlyXp === 0) {
      monthlyTotalUsers += 1;
    }

    const monthlyNextUser = nextMonthlyUser
      ? {
          username: nextMonthlyUser.username,
          xp: nextMonthlyUser.xp,
          gap: nextMonthlyUser.xp - userMonthlyXp,
        }
      : null;

    return res.status(200).json({
      position: higherCount + 1,
      totalUsers,
      userXp,
      nextUser: nextUser
        ? {
            username: nextUser.username,
            xp: nextUser.stats?.userXp ?? 0,
            gap: (nextUser.stats?.userXp ?? 0) - userXp,
          }
        : null,
      monthly: {
        position: aheadCount + 1,
        totalUsers: monthlyTotalUsers,
        userXp: userMonthlyXp,
        nextUser: monthlyNextUser,
      },
    });
  } catch (error) {
    return next(error as customError);
  }
}

// Medium-based ranking with metric selection
export async function getMediumRanking(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const type = req.query.type as string as
      | 'anime'
      | 'manga'
      | 'reading'
      | 'vn'
      | 'video'
      | 'movie'
      | 'tv show'
      | 'audio'
      | undefined;
    const metric = (req.query.metric as string) || 'xp'; // xp | time | episodes | chars | pages
    const timeFilter = (req.query.timeFilter as string) || 'all-time';
    const timezone = (req.query.timezone as string) || 'UTC';
    const startParam = (req.query.start as string) || undefined; // YYYY-MM-DD
    const endParam = (req.query.end as string) || undefined; // YYYY-MM-DD

    // Date filter (copied from getRanking)
    let dateGte: Date | undefined = undefined;
    let dateLt: Date | undefined = undefined;
    const now = new Date();
    const userDate = new Date(
      now.toLocaleString('en-US', { timeZone: timezone })
    );
    const offsetNow = now.getTime() - userDate.getTime();
    if (startParam || endParam) {
      const makeLocal = (s: string) => new Date(`${s}T00:00:00`);
      if (startParam) {
        const startLocal = makeLocal(startParam);
        dateGte = new Date(startLocal.getTime() + offsetNow);
      }
      if (endParam) {
        const endLocal = makeLocal(endParam);
        endLocal.setDate(endLocal.getDate() + 1);
        dateLt = new Date(endLocal.getTime() + offsetNow);
      }
    } else if (timeFilter === 'today') {
      const startLocal = new Date(
        userDate.getFullYear(),
        userDate.getMonth(),
        userDate.getDate()
      );
      dateGte = new Date(startLocal.getTime() + offsetNow);
    } else if (timeFilter === 'week') {
      const startLocal = new Date(
        userDate.getFullYear(),
        userDate.getMonth(),
        userDate.getDate() - userDate.getDay()
      );
      dateGte = new Date(startLocal.getTime() + offsetNow);
    } else if (timeFilter === 'month') {
      const startLocal = new Date(
        userDate.getFullYear(),
        userDate.getMonth(),
        1
      );
      dateGte = new Date(startLocal.getTime() + offsetNow);
    } else if (timeFilter === 'year') {
      const startLocal = new Date(userDate.getFullYear(), 0, 1);
      dateGte = new Date(startLocal.getTime() + offsetNow);
    }

    // Build pipeline
    const pipeline: any[] = [
      {
        $lookup: {
          from: 'logs',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$user', '$$userId'] },
                    ...(dateGte ? [{ $gte: ['$date', dateGte] }] : []),
                    ...(dateLt ? [{ $lt: ['$date', dateLt] }] : []),
                    ...(type ? [{ $eq: ['$type', type] }] : []),
                  ],
                },
              },
            },
            {
              $group: {
                _id: '$user',
                xp: { $sum: '$xp' },
                // minutes for time metric
                minutes: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$type', 'anime'] },
                          {
                            $or: [
                              { $eq: ['$time', 0] },
                              { $eq: ['$time', null] },
                              { $eq: [{ $type: '$time' }, 'missing'] },
                            ],
                          },
                          { $gt: ['$episodes', 0] },
                        ],
                      },
                      { $multiply: ['$episodes', 24] },
                      { $ifNull: ['$time', 0] },
                    ],
                  },
                },
                episodes: { $sum: { $ifNull: ['$episodes', 0] } },
                chars: { $sum: { $ifNull: ['$chars', 0] } },
                pages: { $sum: { $ifNull: ['$pages', 0] } },
              },
            },
            {
              $addFields: {
                hours: { $round: [{ $divide: ['$minutes', 60] }, 1] },
              },
            },
          ],
          as: 'metrics',
        },
      },
      { $unwind: { path: '$metrics', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          _id: 0,
          username: 1,
          avatar: 1,
          patreon: {
            isActive: '$patreon.isActive',
            tier: '$patreon.tier',
            customBadgeText: '$patreon.customBadgeText',
            badgeColor: '$patreon.badgeColor',
            badgeTextColor: '$patreon.badgeTextColor',
          },
          stats: {
            userLevel: '$stats.userLevel',
          },
          xp: '$metrics.xp',
          hours: '$metrics.hours',
          episodes: '$metrics.episodes',
          chars: '$metrics.chars',
          pages: '$metrics.pages',
        },
      },
      // exclude zero values for selected metric
      {
        $match: {
          [metric === 'time' ? 'hours' : metric]: { $gt: 0 },
        },
      },
      {
        $sort: {
          [metric === 'time' ? 'hours' : metric]: -1,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    const ranking = await User.aggregate(pipeline);
    return res.status(200).json(ranking);
  } catch (error) {
    return next(error as customError);
  }
}

export async function getUsers(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const users = await User.find({}).select('-password');
    if (!users) throw new customError('No users found', 404);
    return res.json(users);
  } catch (error) {
    return next(error as customError);
  }
}

export async function clearUserData(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { username } = req.body;

    const user = await User.findById(res.locals.user._id);
    if (!user) {
      throw new customError('User not found', 404);
    }

    // Verify username matches for extra confirmation
    if (username !== user.username) {
      throw new customError(
        'Username does not match. Please type your username to confirm.',
        400
      );
    }

    // Delete user's files from Firebase before clearing data
    if (user.avatar) {
      await deleteFile(user.avatar);
    }
    if (user.banner) {
      await deleteFile(user.banner);
    }

    await user.updateOne({
      clubs: [],
      titles: [],
      roles: ['user'],
      $unset: {
        stats: '',
        firstImport: '',
        discordId: '',
        avatar: '',
        banner: '',
        settings: '',
        patreon: '',
      },
    });

    // Delete all logs
    await Log.deleteMany({ user: user._id });

    // Delete all goals
    const DailyGoal = (await import('../models/dailyGoal.model.js')).default;
    const LongTermGoal = (await import('../models/longTermGoal.model.js'))
      .default;
    await DailyGoal.deleteMany({ user: user._id });
    await LongTermGoal.deleteMany({ user: user._id });
    await Tag.deleteMany({ user: user._id });

    // Fetch updated user to return
    const updatedUser = await User.findById(user._id);
    if (!updatedUser) {
      throw new customError('User not found', 404);
    }

    return res.status(200).json({
      message: 'User data cleared',
      user: {
        _id: updatedUser._id,
        username: updatedUser.username,
        discordId: updatedUser.discordId,
        stats: updatedUser.stats,
        avatar: updatedUser.avatar,
        banner: updatedUser.banner,
        titles: updatedUser.titles,
        roles: updatedUser.roles,
        settings: updatedUser.settings,
      },
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getImmersionList(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) throw new customError('User not found', 404);

    // Define valid media types
    type MediaType =
      | 'anime'
      | 'manga'
      | 'reading'
      | 'vn'
      | 'video'
      | 'movie'
      | 'tv show';

    // Update your interface definition
    interface ImmersionGroup {
      _id: MediaType;
      media: Array<IMediaDocument>;
    }

    const immersionList: ImmersionGroup[] = await Log.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: { mediaId: '$mediaId', type: '$type' },
          lastLogDate: { $max: '$date' },
        },
      },
      {
        $lookup: {
          from: 'media',
          let: { mediaId: '$_id.mediaId', logType: '$_id.type' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$contentId', '$$mediaId'] },
                    { $eq: ['$type', '$$logType'] },
                  ],
                },
              },
            },
          ],
          as: 'mediaDetails',
        },
      },
      { $unwind: '$mediaDetails' },
      {
        $addFields: {
          'mediaDetails.lastLogDate': '$lastLogDate',
        },
      },
      {
        $replaceRoot: { newRoot: '$mediaDetails' },
      },
      {
        $group: {
          _id: '$type',
          media: { $push: '$$ROOT' },
        },
      },
    ]);

    if (immersionList.length === 0) {
      return res.status(200).json({
        anime: [],
        manga: [],
        reading: [],
        vn: [],
        video: [],
        movie: [],
        'tv show': [],
      });
    }

    const result: Record<MediaType, IMediaDocument[]> = {
      anime: [],
      manga: [],
      reading: [],
      vn: [],
      video: [],
      movie: [],
      'tv show': [],
    };

    immersionList.forEach((group) => {
      const mediaType = group._id as MediaType;
      result[mediaType] = group.media;
    });

    // Sort each media type alphabetically
    (Object.keys(result) as MediaType[]).forEach((key) => {
      result[key].sort(
        (a, b) =>
          a.title?.contentTitleNative?.localeCompare(
            b.title?.contentTitleNative || ''
          ) || 0
      );
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error as customError);
  }
}

// LinkType mapping for jiten API
const LinkTypeObject = {
  vn: 2, //VNDB
  anime: 4, // Anilist
  manga: 4, // Anilist
  reading: 4, // Anilist
  movie: 4, // Anilist for movies
};

interface IJitenDeck {
  deckId: number;
  creationDate: Date;
  coverName: string;
  mediaType: number;
  originalTitle: string;
  romajiTitle: string;
  englishTitle: string;
  characterCount: number;
  wordCount: number;
  uniqueWordCount: number;
  uniqueWordUsedOnceCount: number;
  uniqueKanjiCount: number;
  uniqueKanjiUsedOnceCount: number;
  difficulty: number;
  difficultyRaw: number;
  sentenceCount: number;
  averageSentenceLength: number;
  parentDeckId: number | null;
  links: Array<{
    linkId: number;
    linkType: number;
    url: string;
  }>;
  childrenDeckCount: number;
  selectedWordOcurrences: number;
  dialoguePercentage: number;
}

interface IJitenResponse {
  data: {
    parentDeck: IJitenDeck;
    mainDeck: IJitenDeck;
    subDecks: IJitenDeck[];
  };
  totalItems: number;
  pageSize: number;
  currentOffset: number;
}

interface IComparisonStats {
  totalXp: number;
  totalTime: number;
  totalChars: number;
  totalPages: number;
  totalEpisodes: number;
  logCount: number;
  readingSpeed: number;
  readingPercentage: number | null; // null when no character count data available
}

interface IComparisonResult {
  user1: {
    username: string;
    stats: IComparisonStats;
  };
  user2: {
    username: string;
    stats: IComparisonStats;
  };
  mediaInfo: {
    contentId: string;
    type: string;
    totalCharCount?: number;
  };
}

export async function compareUserStats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response<IComparisonResult> | void> {
  try {
    const { user1, user2, mediaId, type } = req.query;

    if (!user1 || !user2 || !mediaId || !type) {
      return res.status(400).json({
        message: 'user1, user2, mediaId, and type are required',
      });
    }

    // Verify users exist
    const [userDoc1, userDoc2] = await Promise.all([
      User.findOne({ username: user1 }).select('_id username'),
      User.findOne({ username: user2 }).select('_id username'),
    ]);

    if (!userDoc1 || !userDoc2) {
      return res.status(404).json({ message: 'One or both users not found' });
    }

    // Get stats for both users in parallel
    const [stats1, stats2] = await Promise.all([
      calculateUserMediaStats(userDoc1._id, mediaId as string, type as string),
      calculateUserMediaStats(userDoc2._id, mediaId as string, type as string),
    ]);

    // Get media info for character count (if applicable)
    let totalCharCount = 0;
    if (['reading', 'manga', 'vn'].includes(type as string)) {
      try {
        // Try to get character count from jiten API
        const jitenURL = process.env.JITEN_API_URL;
        if (jitenURL) {
          const LinkType: number | null = type
            ? (LinkTypeObject[type as keyof typeof LinkTypeObject] ?? null)
            : null;

          if (LinkType) {
            const jitenDeck = await axios.get(
              `${jitenURL}/media-deck/by-link-id/${LinkType}/${mediaId}`,
              {
                validateStatus: (status) => status === 200 || status === 404,
              }
            );

            if (
              jitenDeck.status === 200 &&
              jitenDeck.data &&
              jitenDeck.data.length > 0
            ) {
              const jitenDetailResponse = await axios.get(
                `${jitenURL}/media-deck/${jitenDeck.data[0]}/detail`,
                {
                  validateStatus: (status) => status === 200 || status === 404,
                }
              );

              if (jitenDetailResponse.status === 200) {
                const jitenResponse =
                  jitenDetailResponse.data as IJitenResponse;
                totalCharCount = jitenResponse.data.mainDeck.characterCount;
              }
            }
          }
        }
      } catch (error) {
        console.warn('Error fetching jiten data for comparison:', error);
        // Continue without character count
      }
    }

    // Calculate reading percentages if we have character count
    if (totalCharCount > 0) {
      stats1.readingPercentage = Math.min(
        (stats1.totalChars / totalCharCount) * 100,
        100
      );
      stats2.readingPercentage = Math.min(
        (stats2.totalChars / totalCharCount) * 100,
        100
      );
    } else {
      // No character count data available - set to null so frontend knows not to display completion
      stats1.readingPercentage = null;
      stats2.readingPercentage = null;
    }

    const result: IComparisonResult = {
      user1: {
        username: userDoc1.username,
        stats: stats1,
      },
      user2: {
        username: userDoc2.username,
        stats: stats2,
      },
      mediaInfo: {
        contentId: mediaId as string,
        type: type as string,
        totalCharCount: totalCharCount > 0 ? totalCharCount : undefined,
      },
    };

    return res.status(200).json(result);
  } catch (error) {
    return next(error as customError);
  }
}

async function calculateUserMediaStats(
  userId: any,
  mediaId: string,
  type: string
): Promise<IComparisonStats> {
  const result = await Log.aggregate([
    {
      $match: {
        user: userId,
        mediaId: mediaId,
        type: type,
      },
    },
    {
      $group: {
        _id: null,
        totalXp: { $sum: '$xp' },
        totalTime: { $sum: { $ifNull: ['$time', 0] } },
        totalChars: { $sum: { $ifNull: ['$chars', 0] } },
        totalPages: { $sum: { $ifNull: ['$pages', 0] } },
        totalEpisodes: { $sum: { $ifNull: ['$episodes', 0] } },
        logCount: { $sum: 1 },
      },
    },
  ]);

  const stats = result[0] || {
    totalXp: 0,
    totalTime: 0,
    totalChars: 0,
    totalPages: 0,
    totalEpisodes: 0,
    logCount: 0,
  };

  // Calculate reading speed (chars per hour)
  const readingSpeed =
    stats.totalTime > 0 && stats.totalChars > 0
      ? (stats.totalChars / stats.totalTime) * 60
      : 0;

  return {
    ...stats,
    readingSpeed,
    readingPercentage: null, // Will be set to actual percentage or remain null in main function
  };
}
