import axios from 'axios';
import type { AnyBulkWriteOperation } from 'mongoose';
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

/**
 * Native Jiten difficulty for a media item, or null when unmatched. Nominally
 * a 0-5 scale, but user adjustments can push it slightly past 5 — the XP
 * engine clamps, so callers don't need to.
 *
 * We store `difficultyRaw` rather than the rounded `difficulty` bucket: it's a
 * float on the same scale (strictly more precise — the XP engine's
 * `normalizeJitenDifficulty` is continuous anyway), it folds in Jiten's user
 * difficulty votes, and the bulk deck endpoint exposes it too, so the
 * on-demand path here and the backfill below agree on a single scale. Decks
 * with no votes have `difficultyRaw === difficultyAlgorithmic`, so this is
 * never worse than the base algorithmic value. Note the naming is
 * counterintuitive: `difficultyAlgorithmic` is the unadjusted base and
 * `difficultyRaw` the adjusted result, offset by `userAdjustment`.
 */
export async function fetchJitenDifficulty(
  type: string,
  contentId: string,
  title?: string | null
): Promise<number | null> {
  const detail = await fetchJitenDetail(type, contentId, title);
  const difficulty = detail?.data?.mainDeck?.difficultyRaw;
  return typeof difficulty === 'number' && difficulty >= 0 ? difficulty : null;
}

/** Jiten mediaType ids served by the bulk deck endpoint. */
const JITEN_BULK_MEDIA_TYPES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** The only Jiten linkTypes we can map back onto a `contentId`. */
const JITEN_INDEXED_LINK_TYPES = new Set(
  Object.values(JitenLinkTypeByMediaType)
);

/** The subset of deck fields the bulk endpoint gives us that we actually use. */
interface IJitenBulkDeck {
  deckId: number;
  mediaType: number;
  originalTitle: string | null;
  difficultyRaw: number;
  links: IJitenDeckLink[] | null;
}

export interface IJitenDeckIndex {
  /** `${linkType}:${externalId}` → difficulty. */
  byLink: Map<string, number>;
  /** Normalized book title → difficulty; ambiguous titles are dropped. */
  byBookTitle: Map<string, number>;
  deckCount: number;
}

/**
 * Jiten's `links[].linkId` is its own internal row id, *not* the external
 * site's id — the id we key media on only appears in the link URL's last path
 * segment (https://vndb.org/v55744, https://anilist.co/anime/11755,
 * https://www.google.co.jp/books/edition/<title>/QotNAQAAIAAJ).
 */
function externalIdFromLinkUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '');
  const segment = path.slice(path.lastIndexOf('/') + 1);
  return segment || null;
}

/**
 * Download Jiten's whole deck catalogue (one request per mediaType, ~26MB and
 * ~9s in total) and index it by external link id. This replaces the two
 * per-media round trips (`by-link-id` then `detail`) the backfill used to
 * make, turning an hours-long rate-limited crawl into a local join.
 *
 * Only the fields we need are retained, and each type's parsed response is
 * released before the next is fetched, so peak memory stays bounded by the
 * largest single type (~7MB of JSON) rather than the full catalogue.
 */
export async function fetchJitenDeckIndex(): Promise<IJitenDeckIndex | null> {
  const jitenURL = process.env.JITEN_API_URL;
  if (!jitenURL) return null;

  const byLink = new Map<string, number>();
  const byBookTitle = new Map<string, number>();
  const ambiguousBookTitles = new Set<string>();
  let deckCount = 0;

  for (const mediaType of JITEN_BULK_MEDIA_TYPES) {
    const res = await axios.get<IJitenBulkDeck[]>(
      `${jitenURL}/media-deck/get-media-decks-by-type/${mediaType}`,
      { validateStatus: (status) => status === 200 || status === 404 }
    );
    if (res.status !== 200 || !Array.isArray(res.data)) continue;

    for (const deck of res.data) {
      const difficulty = deck.difficultyRaw;
      if (typeof difficulty !== 'number' || difficulty < 0) continue;
      deckCount += 1;

      for (const link of deck.links ?? []) {
        if (!JITEN_INDEXED_LINK_TYPES.has(link.linkType)) continue;
        const externalId = externalIdFromLinkUrl(link.url);
        if (!externalId) continue;
        const key = `${link.linkType}:${externalId}`;
        if (!byLink.has(key)) byLink.set(key, difficulty);
      }

      // Title index backing the book fallback: ~40% of Jiten's book decks
      // carry no GoogleBooks link, only Bookmeter/Amazon.
      if (JITEN_BOOK_MEDIA_TYPES.has(deck.mediaType)) {
        const title = normalizeTitleForMatch(deck.originalTitle ?? '');
        if (title.length >= 3) {
          const existing = byBookTitle.get(title);
          if (existing !== undefined && existing !== difficulty) {
            ambiguousBookTitles.add(title);
          } else {
            byBookTitle.set(title, difficulty);
          }
        }
      }
    }
  }

  for (const title of ambiguousBookTitles) byBookTitle.delete(title);

  return { byLink, byBookTitle, deckCount };
}

/**
 * Book title fallback against the local catalogue — the offline counterpart of
 * findJitenBookDeckIdByTitle. Containment matches must resolve to a single
 * difficulty: scanning every deck rather than 8 ranked suggestions makes a
 * coincidental substring hit far more likely, so ambiguity is dropped rather
 * than guessed.
 */
function lookupBookDifficultyByTitle(
  index: IJitenDeckIndex,
  title: string | null | undefined
): number | null {
  if (!title) return null;
  const target = normalizeTitleForMatch(title);
  if (target.length < 3) return null;

  const exact = index.byBookTitle.get(target);
  if (exact !== undefined) return exact;

  let match: number | null = null;
  for (const [candidate, difficulty] of index.byBookTitle) {
    if (
      (candidate.includes(target) || target.includes(candidate)) &&
      Math.min(candidate.length, target.length) >= 4
    ) {
      if (match !== null && match !== difficulty) return null;
      match = difficulty;
    }
  }
  return match;
}

/** Resolve one media doc against a prefetched deck index. */
function lookupJitenDifficulty(
  index: IJitenDeckIndex,
  type: string,
  contentId: string,
  title?: string | null
): number | null {
  const normalizedType = String(type).toLowerCase();
  const linkType = JitenLinkTypeByMediaType[normalizedType] ?? null;
  if (!linkType) return null;

  // Jiten links books by their raw Google Books volume id; our book contentId
  // is namespaced as `gbooks-<volumeId>`.
  const externalId =
    normalizedType === 'book' ? contentId.replace(/^gbooks-/, '') : contentId;

  const byLink = index.byLink.get(`${linkType}:${externalId}`);
  if (byLink !== undefined) return byLink;

  if (normalizedType !== 'book') return null;
  return lookupBookDifficultyByTitle(index, title);
}

export interface IJitenBackfillState {
  running: boolean;
  total: number;
  processed: number;
  matched: number;
  decksIndexed: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

let backfillState: IJitenBackfillState = {
  running: false,
  total: 0,
  processed: 0,
  matched: 0,
  decksIndexed: 0,
  startedAt: null,
  finishedAt: null,
  error: null,
};

export function getJitenBackfillState(): IJitenBackfillState {
  return backfillState;
}

const BACKFILL_BATCH_SIZE = 500;

/**
 * Background job: cache Jiten difficulty onto every linkable media doc by
 * joining against the bulk deck index. Idempotent — safe to re-run. By default
 * only media with no difficulty yet are touched; `force` re-tags everything,
 * which is what you want after the stored scale changes.
 *
 * Progress is exposed via getJitenBackfillState().
 */
async function runJitenDifficultyBackfill(force: boolean): Promise<void> {
  const linkableTypes = Object.keys(JitenLinkTypeByMediaType);
  const filter = force
    ? { type: { $in: linkableTypes } }
    : {
        type: { $in: linkableTypes },
        $or: [
          { jitenDifficulty: null },
          { jitenDifficulty: { $exists: false } },
        ],
      };

  try {
    const index = await fetchJitenDeckIndex();
    if (!index) {
      backfillState.error = 'JITEN_API_URL is not configured.';
      return;
    }
    backfillState.decksIndexed = index.deckCount;

    backfillState.total = await MediaBase.countDocuments(filter);

    // Bounded batches keep the driver from buffering a default 16MB page of
    // docs, and keep getMore frequent enough that mongod never reaps the
    // cursor as idle (cursorTimeoutMillis, 10min).
    const cursor = MediaBase.find(filter)
      .select('contentId type title')
      .lean()
      .batchSize(BACKFILL_BATCH_SIZE)
      .cursor();

    const syncedAt = new Date();
    let ops: AnyBulkWriteOperation[] = [];
    const flush = async () => {
      if (!ops.length) return;
      await MediaBase.bulkWrite(ops, { ordered: false });
      ops = [];
    };

    for await (const media of cursor) {
      const nativeTitle = (
        media as { title?: { contentTitleNative?: string } }
      ).title?.contentTitleNative;
      const difficulty = lookupJitenDifficulty(
        index,
        media.type,
        media.contentId,
        nativeTitle
      );
      if (difficulty !== null) {
        ops.push({
          updateOne: {
            filter: { contentId: media.contentId, type: media.type },
            update: {
              $set: { jitenDifficulty: difficulty, jitenSyncedAt: syncedAt },
            },
          },
        });
        backfillState.matched += 1;
        if (ops.length >= BACKFILL_BATCH_SIZE) await flush();
      }
      backfillState.processed += 1;
    }

    await flush();
  } catch (err) {
    backfillState.error = (err as Error)?.message ?? String(err);
    console.error('Jiten difficulty backfill failed:', err);
  } finally {
    backfillState.running = false;
    backfillState.finishedAt = new Date().toISOString();
  }
}

/**
 * Start the background Jiten difficulty backfill if one isn't already running.
 * Returns the current state immediately (the job runs detached).
 */
export function startJitenDifficultyBackfill(force = false): IJitenBackfillState {
  if (backfillState.running) return backfillState;

  backfillState = {
    running: true,
    total: 0,
    processed: 0,
    matched: 0,
    decksIndexed: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  };

  void runJitenDifficultyBackfill(force);
  return backfillState;
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
