import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { userRoles } from '../types.js';
import User from '../models/user.model.js';
import { apiError, ErrorCode } from '../i18n/errorCodes.js';
import { customError } from '../middlewares/errorMiddleware.js';
import {
  createActivityComment,
  deleteActivityComment,
  editActivityComment,
  getActivityFeed,
  likeActivityComment,
  listActivityComments,
  parseActivityLimit,
  parseCommentContent,
  parseReaction,
  removeActivityReaction,
  setActivityReaction,
  unlikeActivityComment,
} from '../services/activity.service.js';
import {
  createNotification,
  removeNotifications,
} from '../services/notifications.service.js';

function parseObjectId(
  value: string,
  code: ErrorCode = 'activity.invalidId'
) {
  if (!Types.ObjectId.isValid(value)) {
    throw apiError(code, 400, 'Invalid activity ID');
  }
  return new Types.ObjectId(value);
}

export async function getFeed(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const scope = req.query.scope ?? 'following';
    if (!['global', 'following', 'clubs', 'user'].includes(String(scope))) {
      throw apiError('activity.invalidScope', 400, 'Invalid feed scope');
    }
    const clubId = req.query.clubId
      ? parseObjectId(String(req.query.clubId), 'activity.invalidClubId')
      : undefined;
    const targetUser =
      scope === 'user'
        ? await User.findOne({ username: String(req.query.username ?? '') })
            .select('_id')
            .collation({ locale: 'en', strength: 2 })
            .lean()
        : null;
    if (scope === 'user' && !targetUser) {
      throw apiError('user.notFound', 404, 'User not found');
    }
    const result = await getActivityFeed({
      viewerId: res.locals.user._id,
      clubIds: res.locals.user.clubs ?? [],
      scope: scope as 'global' | 'following' | 'clubs' | 'user',
      clubId,
      targetUserId: targetUser?._id,
      before: req.query.before,
      limit: req.query.limit,
    });
    return res.status(200).json(result);
  } catch (error) {
    return next(error as customError);
  }
}

export async function reactToActivity(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const activityId = parseObjectId(req.params.activityId);
    const type = parseReaction(req.body.type);
    const { activity, reaction, changed } = await setActivityReaction(
      activityId,
      res.locals.user._id,
      type
    );

    if (changed) {
      await createNotification({
        recipient: activity.actor,
        actor: res.locals.user._id,
        type: 'activity_reaction',
        title: `${res.locals.user.username} liked your activity`,
        titleKey: 'social.reacted',
        link: `/?feed=following&activity=${String(activity._id)}`,
        entityType: 'activity',
        entityId: String(activity._id),
        groupKey: `activity_reaction:${String(activity._id)}:${res.locals.user._id.toString()}`,
        meta: {
          username: res.locals.user.username,
          avatar: res.locals.user.avatar ?? '',
          reaction: reaction.type,
        },
      });
    }

    return res.status(200).json({ reaction: reaction.type });
  } catch (error) {
    return next(error as customError);
  }
}

export async function unreactToActivity(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const activityId = parseObjectId(req.params.activityId);
    const { activity } = await removeActivityReaction(
      activityId,
      res.locals.user._id
    );
    await removeNotifications({
      recipient: activity.actor,
      actor: res.locals.user._id,
      type: 'activity_reaction',
      groupKey: `activity_reaction:${String(activity._id)}:${res.locals.user._id.toString()}`,
    });
    return res.status(204).send();
  } catch (error) {
    return next(error as customError);
  }
}

export async function getComments(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const activityId = parseObjectId(req.params.activityId);
    const page = Math.max(Number.parseInt(String(req.query.page ?? ''), 10) || 1, 1);
    const limit = parseActivityLimit(req.query.limit);
    const result = await listActivityComments(
      activityId,
      res.locals.user._id,
      page,
      limit
    );
    return res.status(200).json({ ...result, page, limit });
  } catch (error) {
    return next(error as customError);
  }
}

export async function addComment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const activityId = parseObjectId(req.params.activityId);
    const content = parseCommentContent(req.body.content);
    const { activity, comment } = await createActivityComment(
      activityId,
      res.locals.user._id,
      content
    );
    await createNotification({
      recipient: activity.actor,
      actor: res.locals.user._id,
      type: 'activity_comment',
      title: `${res.locals.user.username} commented on your activity`,
      titleKey: 'social.commented',
      body: content,
      link: `/?feed=following&activity=${String(activity._id)}`,
      entityType: 'activityComment',
      entityId: String(comment._id),
      meta: {
        username: res.locals.user.username,
        avatar: res.locals.user.avatar ?? '',
      },
    });
    return res.status(201).json({ comment });
  } catch (error) {
    return next(error as customError);
  }
}

export async function editComment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const commentId = parseObjectId(
      req.params.commentId,
      'activity.invalidCommentId'
    );
    const content = parseCommentContent(req.body.content);
    const comment = await editActivityComment(
      commentId,
      res.locals.user._id,
      content
    );
    return res.status(200).json({ comment });
  } catch (error) {
    return next(error as customError);
  }
}

export async function deleteComment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const commentId = parseObjectId(
      req.params.commentId,
      'activity.invalidCommentId'
    );
    const roles = res.locals.user.roles ?? [];
    const canModerate =
      roles.includes(userRoles.admin) || roles.includes(userRoles.mod);
    const comment = await deleteActivityComment(
      commentId,
      res.locals.user._id,
      canModerate
    );
    await removeNotifications({
      entityType: 'activityComment',
      entityId: String(comment._id),
    });
    return res.status(204).send();
  } catch (error) {
    return next(error as customError);
  }
}

export async function likeComment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const activityId = parseObjectId(req.params.activityId);
    const commentId = parseObjectId(
      req.params.commentId,
      'activity.invalidCommentId'
    );
    const { activity, comment, changed } = await likeActivityComment(
      activityId,
      commentId,
      res.locals.user._id
    );

    if (changed) {
      await createNotification({
        recipient: comment.user,
        actor: res.locals.user._id,
        type: 'comment_like',
        title: `${res.locals.user.username} liked your reply`,
        titleKey: 'social.replyLiked',
        link: `/?feed=following&activity=${String(activity._id)}`,
        entityType: 'activityComment',
        entityId: String(comment._id),
        groupKey: `activity_comment_like:${String(comment._id)}:${res.locals.user._id.toString()}`,
        meta: {
          username: res.locals.user.username,
          avatar: res.locals.user.avatar ?? '',
        },
      });
    }

    return res.status(200).json({ liked: true, likeCount: comment.likeCount });
  } catch (error) {
    return next(error as customError);
  }
}

export async function unlikeComment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const activityId = parseObjectId(req.params.activityId);
    const commentId = parseObjectId(
      req.params.commentId,
      'activity.invalidCommentId'
    );
    const { comment, changed } = await unlikeActivityComment(
      activityId,
      commentId,
      res.locals.user._id
    );

    if (changed) {
      await removeNotifications({
        recipient: comment.user,
        actor: res.locals.user._id,
        type: 'comment_like',
        groupKey: `activity_comment_like:${String(comment._id)}:${res.locals.user._id.toString()}`,
      });
    }

    return res.status(200).json({ liked: false, likeCount: comment.likeCount });
  } catch (error) {
    return next(error as customError);
  }
}
