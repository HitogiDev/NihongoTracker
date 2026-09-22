import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import {
  ensureDifferentUsers,
  followUser,
  getSocialSummary,
  parseConnectionsPagination,
} from "../services/follow.service.js";

const mocks = vi.hoisted(() => ({
  updateOne: vi.fn(),
  deleteOne: vi.fn(),
  countDocuments: vi.fn(),
  exists: vi.fn(),
  aggregate: vi.fn(),
}));

vi.mock("../models/follow.model.js", () => ({
  default: mocks,
}));

vi.mock("../models/user.model.js", () => ({
  default: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("follow service", () => {
  it("normalizes and caps pagination", () => {
    expect(parseConnectionsPagination("-3", "500")).toEqual({
      page: 1,
      limit: 50,
    });
    expect(parseConnectionsPagination("2", "10")).toEqual({
      page: 2,
      limit: 10,
    });
    expect(parseConnectionsPagination(undefined, undefined)).toEqual({
      page: 1,
      limit: 20,
    });
  });

  it("rejects following yourself", () => {
    const userId = new Types.ObjectId();
    expect(() => ensureDifferentUsers(userId, userId)).toThrowError(
      "You cannot follow yourself",
    );
  });

  it("reports whether an idempotent upsert created a relationship", async () => {
    const follower = new Types.ObjectId();
    const following = new Types.ObjectId();
    mocks.updateOne.mockResolvedValueOnce({ upsertedCount: 1 });
    mocks.updateOne.mockResolvedValueOnce({ upsertedCount: 0 });

    await expect(followUser(follower, following)).resolves.toBe(true);
    await expect(followUser(follower, following)).resolves.toBe(false);
  });

  it("treats a concurrent duplicate-key race as already followed", async () => {
    mocks.updateOne.mockRejectedValue({ code: 11000 });

    await expect(
      followUser(new Types.ObjectId(), new Types.ObjectId()),
    ).resolves.toBe(false);
  });

  it("exposes a mutual follow only when both directions exist", async () => {
    mocks.countDocuments.mockResolvedValueOnce(12).mockResolvedValueOnce(8);
    mocks.exists.mockResolvedValueOnce({ _id: new Types.ObjectId() });
    mocks.exists.mockResolvedValueOnce({ _id: new Types.ObjectId() });

    await expect(
      getSocialSummary(new Types.ObjectId(), new Types.ObjectId()),
    ).resolves.toEqual({
      followerCount: 12,
      followingCount: 8,
      isFollowing: true,
      isFollowedBy: true,
      mutualFollow: true,
    });
  });
});
