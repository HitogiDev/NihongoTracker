import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import {
  Anime,
  Manga,
  MediaBase,
  Reading,
  Movie,
} from '../models/media.model.js';
import User from '../models/user.model.js';
import UserMediaStatus from '../models/userMediaStatus.model.js';
import MediaReview from '../models/mediaReview.model.js';
import { customError } from '../middlewares/errorMiddleware.js';
import fac from 'fast-average-color-node';
import { searchAnilist } from '../services/searchAnilist.js';
import axios from 'axios';
import { searchDocuments } from '../services/meilisearch/meiliSearch.js';

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
  // "GoogleBooks": 6,
  // "Imdb": 7,
  // "Igdb": 8,
  // "Syosetsu": 9
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

    const normalizedMediaType = mediaType.toLowerCase();
    const mediaQuery = { contentId, type: normalizedMediaType };

    const completionStatus = {
      isCompleted: false,
      completedAt: null as Date | null,
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
          .select('completed completedAt')
          .lean();

        completionStatus.isCompleted = status?.completed ?? false;
        completionStatus.completedAt = status?.completedAt ?? null;
      }
    }

    const jitenURL = process.env.JITEN_API_URL;
    let jitenResponse = null;

    if (jitenURL) {
      try {
        const LinkType: number | null = mediaType
          ? (LinkTypeObject[mediaType as keyof typeof LinkTypeObject] ?? null)
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
    const type =
      req.query.type !== 'tv show' ? (req.query.type as string) : 'tv_show';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.perPage as string) || 10;
    const offset = (page - 1) * limit;

    if (!title || !type)
      return res.status(400).json({ message: 'Invalid query parameters' });

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
