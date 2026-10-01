import { Request, Response } from 'express';
import { Types } from 'mongoose';
import CompanionPresence from '../models/companionPresence.model.js';
import Follow from '../models/follow.model.js';
import User from '../models/user.model.js';
import { getDisplayCapabilities, sanitizeCustomizationForDisplay } from '../services/customization.js';
import { getSocialVisibility, isVisibilityAllowed } from '../services/socialVisibility.service.js';

const EXPIRY_MS = 90_000;

export async function updateCompanionPresence(req: Request, res: Response) {
  const owner = new Types.ObjectId(res.locals.user._id);
  if (req.body?.sharing !== true || req.body?.active !== true) {
    await CompanionPresence.deleteOne({ owner });
    return res.status(200).json({ active: false });
  }
  const mediaTitle = typeof req.body.mediaTitle === 'string' ? req.body.mediaTitle.trim().slice(0, 180) : '';
  const mediaType = typeof req.body.mediaType === 'string' ? req.body.mediaType.trim().slice(0, 40) : '';
  if (!mediaTitle || !mediaType) return res.status(400).json({ message: 'Media title and type are required' });
  const startedAt = new Date(req.body.startedAt);
  const elapsedSeconds = Number(req.body.elapsedSeconds);
  const now = new Date();
  await CompanionPresence.findOneAndUpdate(
    { owner },
    { $set: { active: true, mediaTitle, mediaType, startedAt: Number.isNaN(startedAt.getTime()) ? now : startedAt, elapsedSeconds: Number.isFinite(elapsedSeconds) ? Math.max(0, Math.min(elapsedSeconds, 31_536_000)) : 0, expiresAt: new Date(now.getTime() + EXPIRY_MS) } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return res.status(200).json({ active: true });
}

export async function getFriendsCompanionPresence(_req: Request, res: Response) {
  const viewerId = new Types.ObjectId(res.locals.user._id);
  const [followed, followers] = await Promise.all([
    Follow.find({ follower: viewerId }).distinct('following'),
    Follow.find({ following: viewerId }).distinct('follower'),
  ]);
  const followerSet = new Set(followers.map((id) => id.toString()));
  const mutualIds = followed.filter((id) => followerSet.has(id.toString()));
  if (!mutualIds.length) return res.status(200).json([]);

  const active = await CompanionPresence.find({ owner: { $in: mutualIds }, active: true, expiresAt: { $gt: new Date() } }).lean();
  const owners = await User.find({ _id: { $in: active.map((item) => item.owner) } })
    .select('username avatar patreon customization settings.socialPrivacy').lean();
  const ownerMap = new Map(owners.map((user) => [user._id.toString(), user]));
  const results = active.flatMap((presence) => {
    const user = ownerMap.get(presence.owner.toString());
    if (!user || !isVisibilityAllowed(user._id, getSocialVisibility(user.settings, 'immersionActivity'), viewerId, true, true)) return [];
    const patreon = user.patreon;
    return [{ username: user.username, avatar: user.avatar, customization: sanitizeCustomizationForDisplay(user.customization, getDisplayCapabilities(patreon)), patreon: { isActive: patreon?.isActive ?? false, tier: patreon?.tier ?? null, customBadgeText: patreon?.customBadgeText, badgeColor: patreon?.badgeColor, badgeTextColor: patreon?.badgeTextColor, hideBadge: patreon?.hideBadge ?? false }, mediaTitle: presence.mediaTitle, mediaType: presence.mediaType, startedAt: presence.startedAt, elapsedSeconds: presence.elapsedSeconds, updatedAt: presence.updatedAt }];
  });
  return res.status(200).json(results);
}
