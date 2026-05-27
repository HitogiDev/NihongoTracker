import axios from 'axios';
import { Types } from 'mongoose';
import Log from '../models/log.model.js';
import { MediaBase } from '../models/media.model.js';
import UserMediaStatus from '../models/userMediaStatus.model.js';
import { IMediaDocument } from '../types.js';

const LinkTypeObject: Record<string, number> = {
  vn: 2,
  anime: 4,
  manga: 4,
  reading: 4,
  movie: 4,
};

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
          user: Types.ObjectId(String(userId)),
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
    if (media && typeof (media as any).characters === 'number') {
      const c = Number((media as any).characters);
      if (Number.isFinite(c) && c > 0) mediaCharTotal = c;
    }

    // If we don't have chars but this is a char-based type, try Jiten
    if (
      mediaCharTotal === null &&
      ['reading', 'manga', 'vn', 'game'].includes(normalizedType)
    ) {
      try {
        const jitenURL = process.env.JITEN_API_URL;
        if (jitenURL) {
          const LinkType = LinkTypeObject[normalizedType] ?? null;
          if (LinkType) {
            const byLink = await axios.get(
              `${jitenURL}/media-deck/by-link-id/${LinkType}/${mediaId}`,
              { validateStatus: (s) => s === 200 || s === 404 }
            );
            if (
              byLink.status === 200 &&
              byLink.data &&
              byLink.data.length > 0
            ) {
              const detail = await axios.get(
                `${jitenURL}/media-deck/${byLink.data[0]}/detail`,
                { validateStatus: (s) => s === 200 || s === 404 }
              );
              if (detail.status === 200 && detail.data) {
                mediaCharTotal =
                  Number(detail.data?.data?.mainDeck?.characterCount) || null;
                if (!Number.isFinite(mediaCharTotal) || mediaCharTotal <= 0) {
                  mediaCharTotal = null;
                }
              }
            }
          }
        }
      } catch (err) {
        // Ignore Jiten errors - absence of chars means we can't auto-complete by chars
        console.debug('Jiten lookup failed for', mediaId, err?.message ?? err);
      }
    }

    let shouldComplete: boolean | null = null;

    if (normalizedType === 'anime' || normalizedType === 'tv show') {
      const totalEpisodes = Number((media as any)?.episodes ?? 0);
      if (Number.isFinite(totalEpisodes) && totalEpisodes > 0) {
        shouldComplete = Number(totals.totalEpisodes || 0) >= totalEpisodes;
      }
    } else if (['vn', 'game', 'reading', 'manga'].includes(normalizedType)) {
      if (mediaCharTotal && mediaCharTotal > 0) {
        shouldComplete = Number(totals.totalChars || 0) >= mediaCharTotal;
      }
    }

    if (shouldComplete === null) {
      // Not enough information to decide
      return;
    }

    const statusFilter = {
      user: Types.ObjectId(String(userId)),
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
            user: Types.ObjectId(String(userId)),
            mediaId: String(mediaId),
            type: normalizedType,
          },
        },
        { new: true, upsert: true }
      );
    } else {
      // Not completed according to totals. If previously completed by auto (not user-suppressed), unset it.
      if (existing && existing.completed && !existing.autoCompleteSuppressed) {
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
    }
  } catch (error) {
    console.error('evaluateAutoCompleteForUserMedia error', error);
    // swallow - do not crash logging flow
  }
}

export default { evaluateAutoCompleteForUserMedia };
