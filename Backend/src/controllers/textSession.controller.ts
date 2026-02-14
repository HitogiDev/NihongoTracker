import { Request, Response, NextFunction } from 'express';
import TextSession from '../models/textSession.model.js';
import { MediaBase as Media } from '../models/media.model.js';
import { customError } from '../middlewares/errorMiddleware.js';
import axios from 'axios';

export const checkRoomExists = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { roomId } = req.params;
    const session = await TextSession.findOne({ roomId });
    res.status(200).json({ exists: !!session });
  } catch (error) {
    next(error);
  }
};

const LinkTypeObject = {
  vn: 1,
  manga: 2,
  reading: 3,
} as const;

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
}

export const getRecentSessions = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = res.locals.user._id;
    const sessions = await TextSession.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(20)
      .populate('mediaId', 'title coverImage contentImage contentId');

    // Calculate overall stats
    const allSessions = await TextSession.find({ userId });
    const totalLines = allSessions.reduce((sum, s) => sum + s.lines.length, 0);
    const totalChars = allSessions.reduce(
      (sum, s) =>
        sum + s.lines.reduce((lineSum, l) => lineSum + (l.charsCount || 0), 0),
      0
    );
    const totalTimerSeconds = allSessions.reduce(
      (sum, s) => sum + (s.timerSeconds || 0),
      0
    );

    res.status(200).json({
      sessions,
      stats: {
        totalSessions: allSessions.length,
        totalLines,
        totalChars,
        totalTimerSeconds,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSessionByContentId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = res.locals.user._id;
    const { contentId } = req.params;

    const media = await Media.findOne({ contentId });
    if (!media) {
      throw new customError('Media not found', 404);
    }

    let session = await TextSession.findOne({
      userId,
      mediaId: media._id,
    }).populate('mediaId', 'title coverImage contentImage contentId type');

    if (!session) {
      session = await TextSession.create({
        userId,
        mediaId: media._id,
        lines: [],
      });
      await session.populate(
        'mediaId',
        'title coverImage contentImage contentId type'
      );
    }

    // Get Jiten data if available
    const jitenURL = process.env.JITEN_API_URL;
    let jitenData = null;

    if (jitenURL && ['vn', 'manga', 'reading'].includes(media.type)) {
      try {
        const LinkType: number | null = media.type
          ? (LinkTypeObject[media.type as keyof typeof LinkTypeObject] ?? null)
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
              jitenData = (jitenDetailResponse.data as IJitenResponse).data;
            }
          }
        }
      } catch (error) {
        console.warn('Error fetching Jiten data:', error);
      }
    }

    const response = session.toObject();
    if (typeof response.mediaId === 'object' && response.mediaId !== null) {
      (response.mediaId as any).jiten = jitenData;
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const updateSessionTimer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = res.locals.user._id;
    const { contentId } = req.params;
    const { timerSeconds } = req.body;

    if (typeof timerSeconds !== 'number' || timerSeconds < 0) {
      throw new customError('Invalid timerSeconds value', 400);
    }

    const media = await Media.findOne({ contentId });
    if (!media) {
      throw new customError('Media not found', 404);
    }

    const session = await TextSession.findOneAndUpdate(
      { userId, mediaId: media._id },
      {
        $set: { timerSeconds, updatedAt: new Date() },
      },
      { new: true, upsert: true }
    );

    res.status(200).json({ timerSeconds: session.timerSeconds });
  } catch (error) {
    next(error);
  }
};

export const addLinesToSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = res.locals.user._id;
    const { contentId } = req.params;
    const { lines } = req.body;

    if (!lines || !Array.isArray(lines)) {
      throw new customError('Invalid lines data', 400);
    }

    const media = await Media.findOne({ contentId });
    if (!media) {
      throw new customError('Media not found', 404);
    }

    const session = await TextSession.findOneAndUpdate(
      { userId, mediaId: media._id },
      {
        $push: { lines: { $each: lines } },
        $set: { updatedAt: new Date() },
      },
      { new: true, upsert: true }
    );

    res.status(200).json(session);
  } catch (error) {
    next(error);
  }
};

export const removeLinesFromSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = res.locals.user._id;
    const { contentId } = req.params;
    const { lineIds } = req.body;

    if (!lineIds || !Array.isArray(lineIds) || lineIds.length === 0) {
      throw new customError('Invalid lineIds data', 400);
    }

    const media = await Media.findOne({ contentId });
    if (!media) {
      throw new customError('Media not found', 404);
    }

    const session = await TextSession.findOneAndUpdate(
      { userId, mediaId: media._id },
      {
        $pull: { lines: { id: { $in: lineIds } } },
        $set: { updatedAt: new Date() },
      },
      { new: true }
    );

    if (!session) {
      throw new customError('Session not found', 404);
    }

    res.status(200).json(session);
  } catch (error) {
    next(error);
  }
};

export const clearSessionLines = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = res.locals.user._id;
    const { contentId } = req.params;

    const media = await Media.findOne({ contentId });
    if (!media) {
      throw new customError('Media not found', 404);
    }

    const session = await TextSession.findOneAndUpdate(
      { userId, mediaId: media._id },
      {
        $set: { lines: [], updatedAt: new Date() },
      },
      { new: true }
    );

    if (!session) {
      throw new customError('Session not found', 404);
    }

    res.status(200).json(session);
  } catch (error) {
    next(error);
  }
};

export const deleteSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = res.locals.user._id;
    const { contentId } = req.params;

    const media = await Media.findOne({ contentId });
    if (!media) {
      throw new customError('Media not found', 404);
    }

    const session = await TextSession.findOneAndDelete({
      userId,
      mediaId: media._id,
    });

    if (!session) {
      throw new customError('Session not found', 404);
    }

    res.status(200).json({ message: 'Session deleted successfully' });
  } catch (error) {
    next(error);
  }
};
