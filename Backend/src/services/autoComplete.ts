import { Types } from 'mongoose';
import { fetchJitenDetail } from './jiten.js';
import Log from '../models/log.model.js';
import { MediaBase } from '../models/media.model.js';
import UserMediaStatus from '../models/userMediaStatus.model.js';
import { IMediaDocument } from '../types.js';

export async function evaluateAutoCompleteForUserMedia(
  userId: Types.ObjectId | string,
  mediaId: string,
  type: string
) {
  try {
    const normalizedType = String(type).toLowerCase();

    const agg = await Log.aggregate([
      {
        $match: {
          user: new Types.ObjectId(String(userId)),
          mediaId: String(mediaId),
          type: normalizedType,
        },
      },
      {
        $group: {
          _id: null,
          totalEpisodes: { $sum: { $ifNull: ['$episodes', 0] } },
          totalChars: { $sum: { $ifNull: ['$chars', 0] } },
        },
      },
    ]).allowDiskUse(true);

    const totals = agg[0] || { totalEpisodes: 0, totalChars: 0 };

    const media = (await MediaBase.findOne({
      contentId: String(mediaId),
      type: normalizedType,
    }).lean()) as IMediaDocument | null;

    let mediaCharTotal: number | null = null;
    if (media && typeof media.characters === 'number') {
      const c = Number(media.characters);
      if (Number.isFinite(c) && c > 0) mediaCharTotal = c;
    }

    // If we do not have chars but this is a char-based type, try Jiten
    if (
      mediaCharTotal === null &&
      ['light-novel', 'reading', 'manga', 'vn', 'game', 'book'].includes(
        normalizedType
      )
    ) {
      const detail = await fetchJitenDetail(normalizedType, mediaId);
      const parsedCount = Number(detail?.data.mainDeck.characterCount);
      mediaCharTotal = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : null;
    }

    let shouldComplete: boolean | null = null;

    if (normalizedType === 'anime' || normalizedType === 'tv show') {
      const totalEpisodes = Number(media?.episodes ?? 0);
      if (Number.isFinite(totalEpisodes) && totalEpisodes > 0) {
        shouldComplete = Number(totals.totalEpisodes || 0) >= totalEpisodes;
      }
    } else if (
      ['vn', 'game', 'light-novel', 'reading', 'manga', 'book'].includes(
        normalizedType
      )
    ) {
      if (mediaCharTotal && mediaCharTotal > 0) {
        shouldComplete = Number(totals.totalChars || 0) >= mediaCharTotal;
      }
    }

    if (shouldComplete === null) {
      // Not enough information to decide
      return;
    }

    const statusFilter = {
      user: new Types.ObjectId(String(userId)),
      mediaId: String(mediaId),
      type: normalizedType,
    };
    const existing = await UserMediaStatus.findOne(statusFilter).lean();

    // Preserve explicit manual overrides, but keep in_progress records upgradable.
    if (
      existing &&
      existing.autoCompleteSuppressed === true &&
      existing.status &&
      existing.status !== 'in_progress'
    ) {
      return;
    }

    if (shouldComplete) {
      await UserMediaStatus.findOneAndUpdate(
        statusFilter,
        {
          $set: {
            status: 'completed',
            completed: true,
            completedAt: new Date(),
            autoCompleteSuppressed: false,
          },
          $setOnInsert: {
            user: new Types.ObjectId(String(userId)),
            mediaId: String(mediaId),
            type: normalizedType,
          },
        },
        { new: true, upsert: true }
      );
    } else if (existing && existing.completed && !existing.autoCompleteSuppressed) {
      // Not completed according to totals. If previously completed by auto (not user-suppressed), unset it.
      await UserMediaStatus.updateOne(
        { _id: existing._id },
        {
          $set: {
            completed: false,
            completedAt: null,
            status: 'in_progress',
          },
        }
      );
    }
  } catch (error) {
    console.error('evaluateAutoCompleteForUserMedia error', error);
    // swallow - do not crash logging flow
  }
}

export default { evaluateAutoCompleteForUserMedia };
