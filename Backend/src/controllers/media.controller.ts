import { Request, Response, NextFunction } from 'express';
import {
  Anime,
  Manga,
  MediaBase,
  Reading,
  Movie,
} from '../models/media.model.js';
import { customError } from '../middlewares/errorMiddleware.js';
import fac from 'fast-average-color-node';
import { searchAnilist } from '../services/searchAnilist.js';
import axios from 'axios';
import { searchDocuments } from '../services/meilisearch/meiliSearch.js';

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

    if (!contentId) {
      return res.status(400).json({ message: 'Content ID is required' });
    }

    if (!mediaType) {
      return res.status(400).json({ message: 'Media type is required' });
    }

    const mediaQuery = { contentId, type: mediaType };

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
      (mediaType === 'anime' ||
        mediaType === 'manga' ||
        mediaType === 'reading' ||
        mediaType === 'movie')
    ) {
      const searchType =
        mediaType === 'movie'
          ? 'ANIME'
          : mediaType === 'anime'
            ? 'ANIME'
            : 'MANGA';
      const searchFormat = mediaType === 'movie' ? 'MOVIE' : null;

      const mediaAnilist = await searchAnilist({
        ids: [parseInt(contentId)],
        type: searchType,
        format: searchFormat,
      });

      if (mediaAnilist.length > 0) {
        if (mediaType === 'anime') {
          await Anime.insertMany(mediaAnilist, {
            ordered: false,
          });
        } else if (mediaType === 'manga') {
          await Manga.insertMany(mediaAnilist, {
            ordered: false,
          });
        } else if (mediaType === 'reading') {
          await Reading.insertMany(mediaAnilist, {
            ordered: false,
          });
        } else if (mediaType === 'movie') {
          await Movie.insertMany(mediaAnilist, {
            ordered: false,
          });
        }
        return res.status(200).json({
          ...mediaAnilist[0],
          jiten: jitenResponse ? jitenResponse.data : null,
        });
      } else {
        return res.status(404).json({ message: 'Media not found' });
      }
    }
    if (!media) return res.status(404).json({ message: 'Media not found' });
    return res.status(200).json({
      ...media.toObject(),
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
    const type = req.query.type as string;
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
