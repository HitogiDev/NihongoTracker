import axios from 'axios';
import { MediaBase } from '../models/media.model.js';

/**
 * Jiten link/media integration. Jiten exposes per-media "decks" with a
 * difficulty rating (0-5) that the XP engine turns into a bonus. Decks are
 * looked up by the external id we already store as `contentId` (AniList/VNDB/
 * Google Books id), mapped through Jiten's LinkType enum.
 */

/** Jiten LinkType ids, keyed by our media type. */
export const JitenLinkTypeByMediaType: Record<string, number> = {
  vn: 2, // VNDB
  anime: 4, // AniList
  manga: 4, // AniList
  reading: 4, // AniList
  movie: 4, // AniList
  book: 6, // GoogleBooks
};

/** Jiten mediaType ids that map to our `book` type: Novel(4), NonFiction(5), WebNovel(8). */
const JITEN_BOOK_MEDIA_TYPES = new Set([4, 5, 8]);

export interface IJitenDeckLink {
  linkId: number;
  linkType: number;
  url: string;
  deckId: number;
}

export interface IJitenDeck {
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

export interface IJitenResponse {
  data: {
    parentDeck: IJitenDeck | null;
    mainDeck: IJitenDeck;
    subDecks: IJitenDeck[];
  };
  totalItems: number;
  pageSize: number;
  currentOffset: number;
}

/** Collapse whitespace (incl. fullwidth U+3000) and punctuation for fuzzy title matching. */
function normalizeTitleForMatch(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[!！?？。、,.:：;；「」『』（）()【】[\]〈〉《》~〜・_\-—–]/g, '');
}

/**
 * Fallback Jiten lookup for books whose deck has no GoogleBooks link (~40% of
 * Jiten's book decks are only linked via Bookmeter/Amazon, which we can't map
 * from a Google Books volume id). Fuzzy-match the native title against Jiten's
 * search suggestions, restricted to book decks, and accept only an exact or
 * strong containment match to avoid pulling in an unrelated title.
 */
async function findJitenBookDeckIdByTitle(
  jitenURL: string,
  title: string | null | undefined
): Promise<number | null> {
  if (!title) return null;
  const target = normalizeTitleForMatch(title);
  if (target.length < 3) return null;

  try {
    const res = await axios.get(`${jitenURL}/media-deck/search-suggestions`, {
      params: { query: title, limit: 8 },
      validateStatus: (status) => status === 200,
    });

    const suggestions: {
      deckId: number;
      originalTitle?: string;
      romajiTitle?: string | null;
      mediaType?: number;
    }[] = res.data?.suggestions ?? [];

    for (const suggestion of suggestions) {
      if (
        suggestion.mediaType === undefined ||
        !JITEN_BOOK_MEDIA_TYPES.has(suggestion.mediaType)
      )
        continue;
      const candidate = normalizeTitleForMatch(suggestion.originalTitle ?? '');
      if (!candidate) continue;
      const isMatch =
        candidate === target ||
        ((candidate.includes(target) || target.includes(candidate)) &&
          Math.min(candidate.length, target.length) >= 4);
      if (isMatch) return suggestion.deckId;
    }
  } catch (err) {
    console.debug(
      'Jiten title fallback failed:',
      (err as Error)?.message ?? err
    );
  }

  return null;
}

/**
 * Resolve a Jiten deck's full detail for one of our media items. Returns null
 * when Jiten is not configured, the type has no link mapping, or no deck
 * matches. `title` is only used for the book title fallback.
 */
export async function fetchJitenDetail(
  type: string,
  contentId: string,
  title?: string | null
): Promise<IJitenResponse | null> {
  const jitenURL = process.env.JITEN_API_URL;
  if (!jitenURL) return null;

  const normalizedType = String(type).toLowerCase();
  const linkType = JitenLinkTypeByMediaType[normalizedType] ?? null;
  if (!linkType) return null;

  try {
    // Jiten links books by their raw Google Books volume id; our book
    // contentId is namespaced as `gbooks-<volumeId>`, so strip the prefix.
    const jitenLinkId =
      normalizedType === 'book'
        ? contentId.replace(/^gbooks-/, '')
        : contentId;

    const byLink = await axios.get(
      `${jitenURL}/media-deck/by-link-id/${linkType}/${jitenLinkId}`,
      { validateStatus: (status) => status === 200 || status === 404 }
    );

    let deckId: number | null =
      byLink.status === 200 && byLink.data && byLink.data.length > 0
        ? byLink.data[0]
        : null;

    // Books often aren't linked to Google Books on Jiten (only Bookmeter/
    // Amazon). Fall back to a fuzzy title match so those still resolve.
    if (deckId === null && normalizedType === 'book') {
      deckId = await findJitenBookDeckIdByTitle(jitenURL, title);
    }

    if (deckId === null) return null;

    const detail = await axios.get(
      `${jitenURL}/media-deck/${deckId}/detail`,
      { validateStatus: (status) => status === 200 || status === 404 }
    );

    if (detail.status === 200) return detail.data as IJitenResponse;
  } catch (err) {
    console.warn('Jiten API error:', (err as Error)?.message ?? err);
  }

  return null;
}

/** Native Jiten difficulty (0-5) for a media item, or null when unmatched. */
export async function fetchJitenDifficulty(
  type: string,
  contentId: string,
  title?: string | null
): Promise<number | null> {
  const detail = await fetchJitenDetail(type, contentId, title);
  const difficulty = detail?.data?.mainDeck?.difficulty;
  return typeof difficulty === 'number' && difficulty >= 0 ? difficulty : null;
}

/**
 * Cache Jiten difficulty onto an existing media doc when it isn't set yet.
 * Best-effort and non-throwing. Returns the native difficulty (0-5) if known.
 */
export async function cacheMediaJitenDifficulty(
  contentId: string,
  type: string,
  title?: string | null
): Promise<number | null> {
  try {
    const media = await MediaBase.findOne({ contentId, type })
      .select('jitenDifficulty')
      .lean();
    if (media && media.jitenDifficulty != null) {
      return media.jitenDifficulty;
    }

    const difficulty = await fetchJitenDifficulty(type, contentId, title);
    if (difficulty === null) return null;

    await MediaBase.updateOne(
      { contentId, type },
      { jitenDifficulty: difficulty, jitenSyncedAt: new Date() }
    ).exec();
    return difficulty;
  } catch (err) {
    console.warn(
      'Failed to cache Jiten difficulty:',
      (err as Error)?.message ?? err
    );
    return null;
  }
}
