import { NextFunction, Request, Response } from "express";
import { customError } from "../middlewares/errorMiddleware.js";
import {
  findSocialUser,
  followUser,
  getSocialSummary,
  listConnections,
  parseConnectionsPagination,
  unfollowUser,
} from "../services/follow.service.js";
import {
  createNotification,
  removeNotifications,
} from "../services/notifications.service.js";

export async function followProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const actor = res.locals.user;
    const target = await findSocialUser(req.params.username);
    const created = await followUser(actor._id, target._id);

    if (created) {
      await createNotification({
        recipient: target._id,
        actor: actor._id,
        type: "follow",
        title: `${actor.username} followed you`,
        titleKey: "social.followed",
        link: `/user/${encodeURIComponent(actor.username)}`,
        entityType: "follow",
        entityId: actor._id.toString(),
        groupKey: `follow:${actor._id.toString()}`,
        meta: {
          username: actor.username,
          avatar: actor.avatar ?? "",
        },
      });
    }

    const relationship = await getSocialSummary(target._id, actor._id);
    return res.status(created ? 201 : 200).json({ relationship });
  } catch (error) {
    return next(error as customError);
  }
}

export async function unfollowProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const actor = res.locals.user;
    const target = await findSocialUser(req.params.username);
    const removed = await unfollowUser(actor._id, target._id);

    if (removed) {
      await removeNotifications({
        recipient: target._id,
        actor: actor._id,
        type: "follow",
        entityType: "follow",
        entityId: actor._id.toString(),
      });
    }

    const relationship = await getSocialSummary(target._id, actor._id);
    return res.status(200).json({ relationship });
  } catch (error) {
    return next(error as customError);
  }
}

async function listProfileConnections(
  req: Request,
  res: Response,
  next: NextFunction,
  direction: "followers" | "following",
) {
  try {
    const user = await findSocialUser(req.params.username);
    const { page, limit } = parseConnectionsPagination(
      req.query.page,
      req.query.limit,
    );
    const { users, total } = await listConnections(
      user._id,
      direction,
      page,
      limit,
    );

    return res.status(200).json({ users, total, page, limit });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getFollowers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  return listProfileConnections(req, res, next, "followers");
}

export async function getFollowing(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  return listProfileConnections(req, res, next, "following");
}

export async function getRelationship(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const target = await findSocialUser(req.params.username);
    const relationship = await getSocialSummary(
      target._id,
      res.locals.user._id,
    );
    return res.status(200).json({ relationship });
  } catch (error) {
    return next(error as customError);
  }
}
