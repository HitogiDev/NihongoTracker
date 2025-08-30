import { Request, Response, NextFunction } from 'express';
import Log from '../models/log.model.js';
import User from '../models/user.model.js';
import { customError } from '../middlewares/errorMiddleware.js';
import axios from 'axios';

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
            ? LinkTypeObject[type as keyof typeof LinkTypeObject] ?? null
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
