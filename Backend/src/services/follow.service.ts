import { PipelineStage, Types } from "mongoose";
import Follow from "../models/follow.model.js";
import User from "../models/user.model.js";
import { apiError } from "../i18n/errorCodes.js";

export const MAX_CONNECTIONS_PAGE_SIZE = 50;

export interface SocialRelationship {
  isFollowing: boolean;
  isFollowedBy: boolean;
  mutualFollow: boolean;
}

export interface SocialSummary extends SocialRelationship {
  followerCount: number;
  followingCount: number;
}

export interface ConnectionUser {
  _id: Types.ObjectId;
  username: string;
  avatar?: string;
  followedAt: Date;
}

export function parseConnectionsPagination(
  pageValue: unknown,
  limitValue: unknown,
): { page: number; limit: number } {
  const parsedPage = Number.parseInt(String(pageValue ?? ""), 10);
  const parsedLimit = Number.parseInt(String(limitValue ?? ""), 10);

  return {
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    limit:
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, MAX_CONNECTIONS_PAGE_SIZE)
        : 20,
  };
}

export function ensureDifferentUsers(
  followerId: Types.ObjectId,
  followingId: Types.ObjectId,
): void {
  if (followerId.equals(followingId)) {
    throw apiError("follow.self", 400, "You cannot follow yourself");
  }
}

export async function findSocialUser(username: string) {
  const user = await User.findOne({ username }).collation({
    locale: "en",
    strength: 2,
  });

  if (!user) {
    throw apiError("user.notFound", 404, "User not found");
  }

  return user;
}

export async function followUser(
  followerId: Types.ObjectId,
  followingId: Types.ObjectId,
): Promise<boolean> {
  ensureDifferentUsers(followerId, followingId);

  try {
    const result = await Follow.updateOne(
      { follower: followerId, following: followingId },
      { $setOnInsert: { follower: followerId, following: followingId } },
      { upsert: true },
    );

    return result.upsertedCount === 1;
  } catch (error) {
    // A concurrent first follow can race between the upsert match and insert.
    // The unique index remains the authority, and the loser is idempotent.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return false;
    }
    throw error;
  }
}

export async function unfollowUser(
  followerId: Types.ObjectId,
  followingId: Types.ObjectId,
): Promise<boolean> {
  ensureDifferentUsers(followerId, followingId);
  const result = await Follow.deleteOne({
    follower: followerId,
    following: followingId,
  });
  return result.deletedCount === 1;
}

export async function getSocialSummary(
  targetId: Types.ObjectId,
  viewerId?: Types.ObjectId,
): Promise<SocialSummary> {
  const relationshipQueries = viewerId
    ? [
        Follow.exists({ follower: viewerId, following: targetId }),
        Follow.exists({ follower: targetId, following: viewerId }),
      ]
    : [Promise.resolve(null), Promise.resolve(null)];

  const [followerCount, followingCount, isFollowing, isFollowedBy] =
    await Promise.all([
      Follow.countDocuments({ following: targetId }),
      Follow.countDocuments({ follower: targetId }),
      ...relationshipQueries,
    ]);

  const following = Boolean(isFollowing);
  const followedBy = Boolean(isFollowedBy);

  return {
    followerCount,
    followingCount,
    isFollowing: following,
    isFollowedBy: followedBy,
    mutualFollow: following && followedBy,
  };
}

interface ConnectionFacet {
  users: ConnectionUser[];
  metadata: { total: number }[];
}

export async function listConnections(
  userId: Types.ObjectId,
  direction: "followers" | "following",
  page: number,
  limit: number,
): Promise<{ users: ConnectionUser[]; total: number }> {
  const ownerField = direction === "followers" ? "following" : "follower";
  const connectionField = direction === "followers" ? "follower" : "following";
  const pipeline: PipelineStage[] = [
    { $match: { [ownerField]: userId } },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "users",
        localField: connectionField,
        foreignField: "_id",
        as: "connectedUser",
      },
    },
    { $unwind: "$connectedUser" },
    {
      $project: {
        _id: "$connectedUser._id",
        username: "$connectedUser.username",
        avatar: "$connectedUser.avatar",
        followedAt: "$createdAt",
      },
    },
    {
      $facet: {
        users: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        metadata: [{ $count: "total" }],
      },
    },
  ];

  const [result] = await Follow.aggregate<ConnectionFacet>(pipeline);
  return {
    users: result?.users ?? [],
    total: result?.metadata[0]?.total ?? 0,
  };
}
