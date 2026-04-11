import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import {
  Anime,
  Manga,
  MediaBase,
  Reading,
  Movie,
  VideoGame,
} from '../models/media.model.js';
import User from '../models/user.model.js';
import UserMediaStatus from '../models/userMediaStatus.model.js';
import MediaReview from '../models/mediaReview.model.js';
import { customError } from '../middlewares/errorMiddleware.js';
import fac from 'fast-average-color-node';
import { searchAnilist } from '../services/searchAnilist.js';
import { getIgdbGame, searchIgdb } from '../services/searchIgdb.js';
import axios from 'axios';
import {
  addDocuments,
  searchDocuments,
} from '../services/meilisearch/meiliSearch.js';

const REVIEW_SUMMARY_MIN_LENGTH = 20;
const REVIEW_SUMMARY_MAX_LENGTH = 150;
const REVIEW_CONTENT_MAX_LENGTH = 5000;

export async function getAverageColor(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { imageUrl } = req.query as { imageUrl: string };
    if (!imageUrl) {
      return res.status(400).json({ message: 'Image URL is required' });
    }

    const color = await fac.getAverageColor(imageUrl, {
      algorithm: 'simple',
      mode: 'speed',
      width: 50,
      height: 50,
    });

    return res.status(200).json(color);
  } catch (error) {
    return next(error as customError);
  }
}

const LinkTypeObject = {
  // "Web": 1,
  vn: 2, //VNDB
  // "Tmdb": 3,
  anime: 4, // Anilist
  manga: 4, // Anilist
  reading: 4, // Anilist
  movie: 4, // Anilist for movies
  // "MyAnimeList": 5,
  // "GoogleBooks": 6,
  // "Imdb": 7,
  // "Igdb": 8,
  // "Syosetsu": 9
  // "Bookmeter": 10,
  // "Amazon": 11
};

interface IJitenDeckLink {
  linkId: number;
  linkType: number;
  url: string;
  deckId: number;
}

interface IJitenDeck {
  deckId: number;
  creationDate: string;
  releaseDate: string | null;
  coverName: string;
  mediaType: number;
  originalTitle: string;
  romajiTitle: string | null;
  englishTitle: string | null;
  description: string;
  characterCount: number;
  wordCount: number;
  uniqueWordCount: number;
  uniqueWordUsedOnceCount: number;
  uniqueKanjiCount: number;
  uniqueKanjiUsedOnceCount: number;
  difficulty: number;
  difficultyRaw: number;
  difficultyOverride: number;
  difficultyAlgorithmic: number;
  sentenceCount: number;
  speechDuration: number;
  speechMoraCount: number;
  speechSpeed: number;
  averageSentenceLength: number;
  parentDeckId: number | null;
  links: IJitenDeckLink[];
  aliases: string[];
  childrenDeckCount: number;
  selectedWordOccurrences: number;
  dialoguePercentage: number;
  hideDialoguePercentage: boolean;
  coverage: number;
  uniqueCoverage: number;
  youngCoverage: number;
  youngUniqueCoverage: number;
  externalRating: number;
  exampleSentence: string | null;
  genres: number[];
  tags: unknown[];
  relationships: unknown[];
  status: string | null;
  isFavourite: boolean | null;
  isIgnored: boolean | null;
  distinctVoterCount: number;
  userAdjustment: number;
}

interface IJitenResponse {
  data: {
    parentDeck: IJitenDeck | null;
    mainDeck: IJitenDeck;
    subDecks: IJitenDeck[];
  };
  totalItems: number;
  pageSize: number;
  currentOffset: number;
}

function normalizeMediaTypeParam(mediaType: string): string {
  const rawMediaType = mediaType.trim().toLowerCase();
  const mediaTypeMap: Record<string, string> = {
    game: 'game',
    'video game': 'game',
    videogame: 'game',
  };

  return mediaTypeMap[rawMediaType] ?? rawMediaType;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function indexGameMediaForSearch(media: any[]) {
  if (!media.length) return;

  await addDocuments(
    'game',
    media.map((doc) => ({
      _id: String(doc._id),
      contentId: doc.contentId,
      title: doc.title,
      contentImage: doc.contentImage,
      coverImage: doc.coverImage,
      isAdult: doc.isAdult,
      synonyms: doc.synonyms || [],
      type: doc.type,
    }))
  );
}

export async function getMedia(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { contentId, mediaType } = req.params;
    const requestedUsername =
      typeof req.query.username === 'string' ? req.query.username.trim() : '';

    if (!contentId) {
      return res.status(400).json({ message: 'Content ID is required' });
    }

    if (!mediaType) {
      return res.status(400).json({ message: 'Media type is required' });
    }

    const normalizedMediaType = normalizeMediaTypeParam(mediaType);
    const mediaQuery = { contentId, type: normalizedMediaType };

    const completionStatus = {
      isCompleted: false,
      completedAt: null as Date | null,
      autoCompleteSuppressed: false,
    };

    if (requestedUsername) {
      const targetUser = await User.findOne({ username: requestedUsername })
        .select('_id')
        .lean();

      if (targetUser?._id) {
        const status = await UserMediaStatus.findOne({
          user: targetUser._id,
          mediaId: String(contentId),
          type: normalizedMediaType,
        })
          .select('completed completedAt autoCompleteSuppressed')
          .lean();

        completionStatus.isCompleted = status?.completed ?? false;
        completionStatus.completedAt = status?.completedAt ?? null;
        completionStatus.autoCompleteSuppressed =
          status?.autoCompleteSuppressed ?? false;
      }
    }

    const jitenURL = process.env.JITEN_API_URL;
    let jitenResponse = null;

    if (jitenURL) {
      try {
        const LinkType: number | null = normalizedMediaType
          ? (LinkTypeObject[
              normalizedMediaType as keyof typeof LinkTypeObject
            ] ?? null)
          : null;

        if (LinkType) {
          const jitenDeck = await axios.get(
            `${jitenURL}/media-deck/by-link-id/${LinkType}/${contentId}`,
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
              jitenResponse = jitenDetailResponse.data as IJitenResponse;
            }
          }
        }
      } catch (jitenError) {
        console.warn('Jiten API error:', jitenError);
        // Continue without Jiten data
      }
    }

    const media = await MediaBase.findOne(mediaQuery);

    // Backfill missing AniList metadata on existing records so details pages
    // don't keep showing Unknown for fields like volumes/episodes.
    if (
      media &&
      (normalizedMediaType === 'anime' ||
        normalizedMediaType === 'manga' ||
        normalizedMediaType === 'reading' ||
        normalizedMediaType === 'movie')
    ) {
      const needsAnimeFields =
        normalizedMediaType === 'anime' &&
        (media.episodes == null || media.episodeDuration == null);
      const needsMangaLikeFields =
        (normalizedMediaType === 'manga' ||
          normalizedMediaType === 'reading') &&
        (media.chapters == null || media.volumes == null);

      if (needsAnimeFields || needsMangaLikeFields) {
        const parsedContentId = Number.parseInt(contentId, 10);

        if (!Number.isNaN(parsedContentId)) {
          const refreshType =
            normalizedMediaType === 'anime' ? 'ANIME' : 'MANGA';
          const refreshFormat = null;

          const refreshedFromAnilist = await searchAnilist({
            ids: [parsedContentId],
            type: refreshType,
            format: refreshFormat,
          });

          const refreshedMedia = refreshedFromAnilist[0];
          if (refreshedMedia) {
            const metadataUpdates: Record<string, number> = {};

            if (media.episodes == null && refreshedMedia.episodes != null) {
              metadataUpdates.episodes = refreshedMedia.episodes;
            }
            if (
              media.episodeDuration == null &&
              refreshedMedia.episodeDuration != null
            ) {
              metadataUpdates.episodeDuration = refreshedMedia.episodeDuration;
            }
            if (media.chapters == null && refreshedMedia.chapters != null) {
              metadataUpdates.chapters = refreshedMedia.chapters;
            }
            if (media.volumes == null && refreshedMedia.volumes != null) {
              metadataUpdates.volumes = refreshedMedia.volumes;
            }

            if (Object.keys(metadataUpdates).length > 0) {
              await MediaBase.updateOne(
                { _id: media._id },
                { $set: metadataUpdates }
              );
              Object.assign(media, metadataUpdates);
            }
          }
        }
      }
    }

    if (
      !media &&
      (normalizedMediaType === 'anime' ||
        normalizedMediaType === 'manga' ||
        normalizedMediaType === 'reading' ||
        normalizedMediaType === 'movie')
    ) {
      const searchType =
        normalizedMediaType === 'movie'
          ? 'ANIME'
          : normalizedMediaType === 'anime'
            ? 'ANIME'
            : 'MANGA';
      const searchFormat = normalizedMediaType === 'movie' ? 'MOVIE' : null;

      const mediaAnilist = await searchAnilist({
        ids: [parseInt(contentId)],
        type: searchType,
        format: searchFormat,
      });

      if (mediaAnilist.length > 0) {
        if (normalizedMediaType === 'anime') {
          await Anime.insertMany(mediaAnilist, {
            ordered: false,
          });
        } else if (normalizedMediaType === 'manga') {
          await Manga.insertMany(mediaAnilist, {
            ordered: false,
          });
        } else if (normalizedMediaType === 'reading') {
          await Reading.insertMany(mediaAnilist, {
            ordered: false,
          });
        } else if (normalizedMediaType === 'movie') {
          await Movie.insertMany(mediaAnilist, {
            ordered: false,
          });
        }
        return res.status(200).json({
          ...mediaAnilist[0],
          ...completionStatus,
          jiten: jitenResponse ? jitenResponse.data : null,
        });
      } else {
        return res.status(404).json({ message: 'Media not found' });
      }
    }

    if (!media && normalizedMediaType === 'game') {
      const parsedIgdbId = contentId.startsWith('igdb-')
        ? Number.parseInt(contentId.slice(5), 10)
        : Number.parseInt(contentId, 10);

      if (!Number.isNaN(parsedIgdbId)) {
        const igdbMedia = await getIgdbGame(parsedIgdbId);

        if (igdbMedia) {
          const savedMedia = await VideoGame.findOneAndUpdate(
            { contentId: igdbMedia.contentId, type: 'game' },
            { $setOnInsert: igdbMedia },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );

          if (savedMedia) {
            await indexGameMediaForSearch([savedMedia]);

            return res.status(200).json({
              ...savedMedia.toObject(),
              ...completionStatus,
              jiten: null,
            });
          }
        }
      }

      return res.status(404).json({ message: 'Media not found' });
    }

    if (!media) return res.status(404).json({ message: 'Media not found' });
    return res.status(200).json({
      ...media.toObject(),
      ...completionStatus,
      jiten: jitenResponse ? jitenResponse.data : null,
    });
  } catch (error) {
    return next(error as customError);
  }
}

export async function searchMedia(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const title = req.query.search as string;
    const rawType = String(req.query.type || '')
      .trim()
      .toLowerCase();
    const normalizedTypeMap: Record<string, string> = {
      anime: 'anime',
      manga: 'manga',
      reading: 'reading',
      'light novel': 'reading',
      'light novels': 'reading',
      light_novel: 'reading',
      'light-novel': 'reading',
      ln: 'reading',
      vn: 'vn',
      movie: 'movie',
      'tv show': 'tv_show',
      tv_show: 'tv_show',
      game: 'game',
      'video game': 'game',
      videogame: 'game',
    };
    const type = normalizedTypeMap[rawType] ?? rawType;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.perPage as string) || 10;
    const offset = (page - 1) * limit;

    if (!title || !type)
      return res.status(400).json({ message: 'Invalid query parameters' });

    const allowedTypes = new Set([
      'anime',
      'manga',
      'reading',
      'vn',
      'movie',
      'tv_show',
      'game',
    ]);

    if (!allowedTypes.has(type)) {
      return res.status(400).json({ message: 'Unsupported media type' });
    }

    if (type === 'game') {
      const normalizedTitle = title.trim();
      if (!normalizedTitle) {
        return res.status(200).json([]);
      }

      const gameRegex = new RegExp(escapeRegex(normalizedTitle), 'i');

      const dbMedia = await MediaBase.find({
        type: 'game',
        $or: [
          { 'title.contentTitleNative': gameRegex },
          { 'title.contentTitleEnglish': gameRegex },
          { 'title.contentTitleRomaji': gameRegex },
          { synonyms: { $elemMatch: { $regex: gameRegex } } },
        ],
      })
        .select('contentId title contentImage coverImage isAdult synonyms type')
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean();

      if (dbMedia.length > 0) {
        await indexGameMediaForSearch(dbMedia);
        return res.status(200).json(dbMedia);
      }

      const igdbResults = await searchIgdb(normalizedTitle);
      if (!igdbResults.length) {
        return res.status(200).json([]);
      }

      const igdbContentIds = igdbResults.map((item) => item.contentId);

      const existingMedia = await MediaBase.find({
        type: 'game',
        contentId: { $in: igdbContentIds },
      })
        .select('contentId title contentImage coverImage isAdult synonyms type')
        .lean();

      const existingIds = new Set(existingMedia.map((item) => item.contentId));
      const newMedia = igdbResults.filter(
        (item) => !existingIds.has(item.contentId)
      );

      if (newMedia.length > 0) {
        await VideoGame.insertMany(newMedia, { ordered: false });
      }

      const combinedMedia = await MediaBase.find({
        type: 'game',
        contentId: { $in: igdbContentIds },
      })
        .select('contentId title contentImage coverImage isAdult synonyms type')
        .lean();

      await indexGameMediaForSearch(combinedMedia);

      return res.status(200).json(combinedMedia.slice(0, limit));
    }

    const media = await searchDocuments(type, title, { limit, offset });

    return res.status(200).json(media.hits);
  } catch (error) {
    return next(error as customError);
  }
}

export async function addMediaReview(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { mediaType, contentId } = req.params;
    const { content, rating, hasSpoilers, summary } = req.body;
    const userId = res.locals.user?._id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const trimmedSummary = summary?.trim();
    const trimmedContent = content?.trim();

    if (!trimmedSummary || trimmedSummary.length === 0) {
      return res.status(400).json({ message: 'Review summary is required' });
    }

    if (trimmedSummary.length < REVIEW_SUMMARY_MIN_LENGTH) {
      return res.status(400).json({
        message: `Review summary must be at least ${REVIEW_SUMMARY_MIN_LENGTH} characters`,
      });
    }

    if (trimmedSummary.length > REVIEW_SUMMARY_MAX_LENGTH) {
      return res.status(400).json({
        message: `Review summary must be ${REVIEW_SUMMARY_MAX_LENGTH} characters or less`,
      });
    }

    if (!trimmedContent || trimmedContent.length === 0) {
      return res.status(400).json({ message: 'Review content is required' });
    }

    if (content.length > REVIEW_CONTENT_MAX_LENGTH) {
      return res.status(400).json({
        message: `Review content must be ${REVIEW_CONTENT_MAX_LENGTH} characters or less`,
      });
    }

    if (rating && (rating < 0.5 || rating > 5 || (rating * 2) % 1 !== 0)) {
      return res.status(400).json({
        message: 'Rating must be between 0.5 and 5 in 0.5 increments',
      });
    }

    const existingReview = await MediaReview.findOne({
      user: userId,
      mediaContentId: contentId,
      mediaType,
    });

    if (existingReview) {
      return res
        .status(400)
        .json({ message: 'You have already reviewed this media' });
    }

    const review = await MediaReview.create({
      user: userId,
      mediaContentId: contentId,
      mediaType,
      summary: trimmedSummary,
      content: trimmedContent,
      rating,
      hasSpoilers: hasSpoilers || false,
      likes: [],
    });

    return res
      .status(201)
      .json({ message: 'Review added successfully', review });
  } catch (error) {
    if ((error as Error).message.includes('E11000')) {
      return res
        .status(400)
        .json({ message: 'You have already reviewed this media' });
    }
    return next(error as customError);
  }
}

export async function getMediaReviews(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { mediaType, contentId } = req.params;

    const reviews = await MediaReview.find({
      mediaContentId: contentId,
      mediaType,
    })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 });

    return res.status(200).json({ reviews });
  } catch (error) {
    return next(error as customError);
  }
}

export async function editMediaReview(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { mediaType, contentId, reviewId } = req.params;
    const { content, rating, hasSpoilers, summary } = req.body;
    const userId = res.locals.user?._id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    const trimmedSummary = summary?.trim();
    const trimmedContent = content?.trim();

    if (!trimmedSummary || trimmedSummary.length === 0) {
      return res.status(400).json({ message: 'Review summary is required' });
    }

    if (trimmedSummary.length < REVIEW_SUMMARY_MIN_LENGTH) {
      return res.status(400).json({
        message: `Review summary must be at least ${REVIEW_SUMMARY_MIN_LENGTH} characters`,
      });
    }

    if (trimmedSummary.length > REVIEW_SUMMARY_MAX_LENGTH) {
      return res.status(400).json({
        message: `Review summary must be ${REVIEW_SUMMARY_MAX_LENGTH} characters or less`,
      });
    }

    if (!trimmedContent || trimmedContent.length === 0) {
      return res.status(400).json({ message: 'Review content is required' });
    }

    if (content.length > REVIEW_CONTENT_MAX_LENGTH) {
      return res.status(400).json({
        message: `Review content must be ${REVIEW_CONTENT_MAX_LENGTH} characters or less`,
      });
    }

    if (rating && (rating < 0.5 || rating > 5 || (rating * 2) % 1 !== 0)) {
      return res.status(400).json({
        message: 'Rating must be between 0.5 and 5 in 0.5 increments',
      });
    }

    const review = await MediaReview.findOne({
      _id: reviewId,
      mediaContentId: contentId,
      mediaType,
      user: userId,
    });

    if (!review) {
      return res
        .status(404)
        .json({ message: 'Review not found or you are not the author' });
    }

    review.summary = trimmedSummary;
    review.content = trimmedContent;
    review.hasSpoilers = hasSpoilers || false;
    review.editedAt = new Date();
    if (rating !== undefined) {
      review.rating = rating;
    }

    await review.save();

    const updatedReview = await MediaReview.findById(reviewId).populate(
      'user',
      'username avatar'
    );

    return res
      .status(200)
      .json({ message: 'Review updated successfully', review: updatedReview });
  } catch (error) {
    return next(error as customError);
  }
}

export async function toggleMediaReviewLike(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { mediaType, contentId, reviewId } = req.params;
    const userId = res.locals.user?._id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    const review = await MediaReview.findOne({
      _id: reviewId,
      mediaContentId: contentId,
      mediaType,
    });

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const userIdString = userId.toString();
    const isLiked = review.likes.some((id) => id.toString() === userIdString);

    if (isLiked) {
      review.likes = review.likes.filter(
        (id) => id.toString() !== userIdString
      );
    } else {
      review.likes.push(userId);
    }

    await review.save();

    return res.status(200).json({
      message: isLiked ? 'Review unliked' : 'Review liked',
      liked: !isLiked,
      likesCount: review.likes.length,
    });
  } catch (error) {
    return next(error as customError);
  }
}
export async function deleteMediaReview(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { mediaType, contentId, reviewId } = req.params;
    const userId = res.locals.user?._id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    const review = await MediaReview.findOneAndDelete({
      _id: reviewId,
      mediaContentId: contentId,
      mediaType,
      user: userId,
    });

    if (!review) {
      return res
        .status(404)
        .json({ message: 'Review not found or you are not the author' });
    }

    return res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    return next(error as customError);
  }
}

export async function getMediaReviewById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { reviewId } = req.params;

    if (!Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    const review = await MediaReview.findById(reviewId).populate(
      'user',
      'username avatar'
    );

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Fetch associated media document
    const media = await MediaBase.findOne({
      contentId: review.mediaContentId,
      type: review.mediaType,
    });

    return res.status(200).json({
      review,
      media: media ? media.toObject() : null,
    });
  } catch (error) {
    return next(error as customError);
  }
}
