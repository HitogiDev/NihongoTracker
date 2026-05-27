import os from 'os';
import path from 'path';
import VndbDumpSyncState, {
  VNDB_DUMP_SYNC_STATE_ID,
  IVndbDumpSyncCounters,
  IVndbDumpSyncState,
} from '../models/vndbDumpSyncState.model.js';
import { MediaBase } from '../models/media.model.js';
import { getVndbDumpFileName, downloadVndbDump } from './vndbDumpClient.js';
import {
  extractVndbDump,
  cleanupDumpDir,
} from './vndbDumpExtractor.js';
import { readHeaderFile, streamTsvRows } from './vndbDumpParser.js';
import {
  mapLanguageCode,
  buildVndbImageUrl,
  parseVnAliases,
} from './vndbFilterPolicy.js';
import { addDocuments, deleteDocuments } from './meilisearch/meiliSearch.js';

export type VndbSyncTrigger = 'manual' | 'scheduled';

export interface IVndbDumpSyncStatusResponse {
  isRunning: boolean;
  currentPhase: string;
  currentMessage: string;
  lastTrigger: 'manual' | 'scheduled' | 'unknown';
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastSuccessfulAt: Date | null;
  lastFailedAt: Date | null;
  lastError: string;
  lastDumpFileName: string;
  counters: IVndbDumpSyncCounters;
  updatedAt: Date | null;
}

export interface IStartVndbDumpSyncResult {
  started: boolean;
  message: string;
  status: IVndbDumpSyncStatusResponse;
}

interface IStartVndbDumpSyncOptions {
  force?: boolean;
}

interface INormalizedVnMedia {
  contentId: string;
  type: 'vn';
  title: {
    contentTitleNative: string;
    contentTitleRomaji: string | null;
    contentTitleEnglish: string | null;
  };
  contentImage: string | null;
  coverImage: null;
  description: Array<{ description: string; language: 'eng' | 'jpn' | 'spa' }>;
  synonyms: string[];
  genres: string[];
  isAdult: boolean;
  /** true when VNDB image sexual avg >= 100 (suggestive or explicit) */
  isAdultImage: boolean;
}

/** Titles collected per VN id while streaming vn_titles */
interface IVnTitleInfo {
  native: string | null;
  romaji: string | null;
  english: string | null;
}

let activeSyncPromise: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

function getBatchSize(): number {
  const raw = Number.parseInt(
    process.env.VNDB_DUMP_SYNC_BATCH_SIZE || '250',
    10
  );
  if (!Number.isFinite(raw) || raw < 1) return 250;
  return Math.min(raw, 5000);
}

function getIndexBatchSize(): number {
  const raw = Number.parseInt(
    process.env.VNDB_DUMP_SYNC_INDEX_BATCH_SIZE || '100',
    10
  );
  if (!Number.isFinite(raw) || raw < 1) return 100;
  return Math.min(raw, 1000);
}

function getLockDurationMs(): number {
  const minutes = Number.parseInt(
    process.env.VNDB_DUMP_SYNC_LOCK_MINUTES || '480',
    10
  );
  if (!Number.isFinite(minutes) || minutes < 5) return 480 * 60 * 1000;
  return minutes * 60 * 1000;
}

function getTempBaseDir(): string {
  return process.env.VNDB_DUMP_TEMP_DIR || os.tmpdir();
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

function defaultStatus(): IVndbDumpSyncStatusResponse {
  return {
    isRunning: false,
    currentPhase: '',
    currentMessage: 'No sync has been started yet',
    lastTrigger: 'unknown',
    lastStartedAt: null,
    lastFinishedAt: null,
    lastSuccessfulAt: null,
    lastFailedAt: null,
    lastError: '',
    lastDumpFileName: '',
    counters: { scanned: 0, upserted: 0, skipped: 0, failed: 0 },
    updatedAt: null,
  };
}

function mapStateToStatus(
  state: IVndbDumpSyncState | null
): IVndbDumpSyncStatusResponse {
  if (!state) return defaultStatus();

  return {
    isRunning: state.isRunning,
    currentPhase: state.currentPhase,
    currentMessage: state.currentMessage,
    lastTrigger: state.lastTrigger,
    lastStartedAt: state.lastStartedAt,
    lastFinishedAt: state.lastFinishedAt,
    lastSuccessfulAt: state.lastSuccessfulAt,
    lastFailedAt: state.lastFailedAt,
    lastError: state.lastError,
    lastDumpFileName: state.lastDumpFileName,
    counters: state.counters,
    updatedAt: state.updatedAt || null,
  };
}

async function getStateDocument(): Promise<IVndbDumpSyncState | null> {
  return await VndbDumpSyncState.findById(VNDB_DUMP_SYNC_STATE_ID)
    .lean<IVndbDumpSyncState>()
    .exec();
}

async function updateState(
  update: Record<string, unknown>
): Promise<IVndbDumpSyncState | null> {
  return await VndbDumpSyncState.findByIdAndUpdate(
    VNDB_DUMP_SYNC_STATE_ID,
    update,
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
    .lean<IVndbDumpSyncState>()
    .exec();
}

async function acquireLock(
  trigger: VndbSyncTrigger
): Promise<IVndbDumpSyncState | null> {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + getLockDurationMs());

  return await VndbDumpSyncState.findOneAndUpdate(
    {
      _id: VNDB_DUMP_SYNC_STATE_ID,
      $or: [
        { lockUntil: { $lte: now } },
        { lockUntil: null },
        { lockUntil: { $exists: false } },
      ],
    },
    {
      $setOnInsert: { _id: VNDB_DUMP_SYNC_STATE_ID },
      $set: {
        isRunning: true,
        lockUntil,
        lastTrigger: trigger,
        lastStartedAt: now,
        currentPhase: 'initializing',
        currentMessage: 'Starting VNDB dump sync',
        lastError: '',
        counters: { scanned: 0, upserted: 0, skipped: 0, failed: 0 },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
    .lean<IVndbDumpSyncState>()
    .exec();
}

async function touchLockAndProgress(
  phase: string,
  message: string,
  counters: IVndbDumpSyncCounters,
  additionalSet: Record<string, unknown> = {}
): Promise<void> {
  const lockUntil = new Date(Date.now() + getLockDurationMs());
  await updateState({
    $set: {
      currentPhase: phase,
      currentMessage: message,
      counters,
      lockUntil,
      ...additionalSet,
    },
  });
}

async function finalizeRunSuccess(
  message: string,
  counters: IVndbDumpSyncCounters,
  extraSet: Record<string, unknown> = {}
): Promise<void> {
  const now = new Date();
  await updateState({
    $set: {
      isRunning: false,
      lockUntil: null,
      currentPhase: 'idle',
      currentMessage: message,
      lastFinishedAt: now,
      lastSuccessfulAt: now,
      lastError: '',
      counters,
      ...extraSet,
    },
  });
}

async function finalizeRunFailure(
  errorMessage: string,
  counters: IVndbDumpSyncCounters
): Promise<void> {
  const now = new Date();
  await updateState({
    $set: {
      isRunning: false,
      lockUntil: null,
      currentPhase: 'error',
      currentMessage: 'VNDB dump sync failed',
      lastFinishedAt: now,
      lastFailedAt: now,
      lastError: errorMessage,
      counters,
    },
  });
}

// ---------------------------------------------------------------------------
// Phase helpers
// ---------------------------------------------------------------------------

/**
 * Stream the `images` table to build a per-image adult-image flag.
 * VNDB stores c_sexual_avg as 0–200 (average vote × 100).
 * Unvoted images default to 200 (VNDB's conservative default = assume explicit).
 * We treat an image as adult if c_sexual_avg >= 100 (suggestive or explicit on average).
 */
async function buildImageRatingMap(
  dbDir: string
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  const headers = await readHeaderFile(path.join(dbDir, 'images.header'));

  for await (const row of streamTsvRows(path.join(dbDir, 'images'), headers)) {
    const id = row['id'];
    if (!id) continue;

    // Only interested in cover images (prefix 'cv') — skip character/screenshot images
    if (!id.startsWith('cv')) continue;

    const raw = row['c_sexual_avg'];
    const avg = raw !== null ? Number(raw) : 200; // default 200 if null
    map.set(id, avg >= 100);
  }

  console.log(`✅ VNDB: built image rating map for ${map.size} cover image(s)`);
  return map;
}

/**
 * Stream releases + releases_vn to build two sets:
 *   - japaneseVnIds: VNs with at least one release where olang = 'ja'
 *   - adultVnIds:    VNs with at least one adult release (has_ero OR minage >= 18)
 *
 * Both flags are collected in a single pass through `releases`, then
 * a single pass through `releases_vn` maps release IDs → VN IDs.
 */
async function buildReleaseVnSets(
  dbDir: string,
  counters: IVndbDumpSyncCounters
): Promise<{ adultVnIds: Set<string>; japaneseVnIds: Set<string> }> {
  const adultReleaseIds = new Set<string>();
  const jaReleaseIds = new Set<string>();
  const adultVnIds = new Set<string>();
  const japaneseVnIds = new Set<string>();

  // --- Pass 1: single scan of `releases` — collect adult and Japanese release ids ---
  const relHeaders = await readHeaderFile(path.join(dbDir, 'releases.header'));
  for await (const row of streamTsvRows(
    path.join(dbDir, 'releases'),
    relHeaders
  )) {
    counters.scanned += 1;

    const id = row['id'];
    if (!id) continue;

    // Japanese: olang (original language of this release) is 'ja'
    if (row['olang'] === 'ja') {
      jaReleaseIds.add(id);
    }

    // Adult: ero flag or age rating >= 18
    const hasEro = row['has_ero'];
    const minage = row['minage'];
    const isAdult =
      hasEro === 't' ||
      (minage !== null && Number.isFinite(Number(minage)) && Number(minage) >= 18);

    if (isAdult) {
      adultReleaseIds.add(id);
    }
  }

  console.log(
    `✅ VNDB: found ${jaReleaseIds.size} Japanese release(s) and ${adultReleaseIds.size} adult release(s)`
  );

  // --- Pass 2: map release ids → VN ids via releases_vn (single pass for both sets) ---
  const rvHeaders = await readHeaderFile(
    path.join(dbDir, 'releases_vn.header')
  );
  for await (const row of streamTsvRows(
    path.join(dbDir, 'releases_vn'),
    rvHeaders
  )) {
    const releaseId = row['id'];
    const vnId = row['vid'];

    if (!releaseId || !vnId) continue;

    if (jaReleaseIds.has(releaseId)) {
      japaneseVnIds.add(vnId);
    }
    if (adultReleaseIds.has(releaseId)) {
      adultVnIds.add(vnId);
    }
  }

  console.log(
    `✅ VNDB: ${japaneseVnIds.size} VN(s) with a Japanese release, ${adultVnIds.size} adult`
  );

  return { adultVnIds, japaneseVnIds };
}

/**
 * Stream vn_titles to build a per-VN title map.
 * For each VN we store:
 *   - native: title in the original language (lang == olang of the vn, handled during vn pass)
 *   - romaji: latin transcription of the original-language title
 *   - english: official English title (lang == 'en')
 *
 * Since we don't know olang here, we store ALL titles keyed by lang so the
 * vn-processing pass can look up the right native title.
 */
async function buildTitleMap(
  dbDir: string,
  counters: IVndbDumpSyncCounters
): Promise<Map<string, Map<string, { title: string | null; latin: string | null }>>> {
  // Map<vnId, Map<lang, {title, latin}>>
  const map = new Map<
    string,
    Map<string, { title: string | null; latin: string | null }>
  >();

  const headers = await readHeaderFile(
    path.join(dbDir, 'vn_titles.header')
  );

  for await (const row of streamTsvRows(
    path.join(dbDir, 'vn_titles'),
    headers
  )) {
    counters.scanned += 1;

    const vnId = row['id'];
    const lang = row['lang'];
    const title = row['title'];
    const latin = row['latin'];

    if (!vnId || !lang) continue;

    if (!map.has(vnId)) {
      map.set(vnId, new Map());
    }

    map.get(vnId)!.set(lang, { title, latin });
  }

  console.log(`✅ VNDB: built title map for ${map.size} VN(s)`);
  return map;
}

/**
 * Resolve the IVnTitleInfo for a single VN given its olang and title map entry.
 */
function resolveTitles(
  vnId: string,
  olang: string | null,
  titleMap: Map<string, Map<string, { title: string | null; latin: string | null }>>
): IVnTitleInfo {
  const langMap = titleMap.get(vnId);

  if (!langMap) {
    return { native: null, romaji: null, english: null };
  }

  const origLang = olang || 'ja';
  const origEntry = langMap.get(origLang);
  const enEntry = langMap.get('en');

  return {
    native: origEntry?.title ?? null,
    romaji: origEntry?.latin ?? null,
    english: enEntry?.title ?? enEntry?.latin ?? null,
  };
}

/**
 * Normalize one row from the `vn` table into a MongoDB-ready document.
 * Returns null if the row is missing required fields OR has no Japanese release.
 */
function normalizeVnRow(
  row: Record<string, string | null>,
  adultVnIds: Set<string>,
  japaneseVnIds: Set<string>,
  imageRatingMap: Map<string, boolean>,
  titleMap: Map<string, Map<string, { title: string | null; latin: string | null }>>
): INormalizedVnMedia | null {
  const id = row['id'];
  if (!id) return null;

  // Only import VNs with at least one Japanese release
  if (!japaneseVnIds.has(id)) return null;

  const olang = row['olang'];
  const { native, romaji, english } = resolveTitles(id, olang, titleMap);

  // Must have at least a native title
  const nativeTitle = native || english || id;

  const imageId = row['image'] || row['c_image'];
  const contentImage = buildVndbImageUrl(imageId);

  // isAdultImage: look up the cover image's community sexual rating.
  // If the image isn't in the map (unvoted / no cover), default to false.
  const isAdultImage = imageId ? (imageRatingMap.get(imageId) ?? false) : false;

  const rawDescription = row['description'];
  const mappedLang = mapLanguageCode(olang);
  const descriptionEntries: Array<{
    description: string;
    language: 'eng' | 'jpn' | 'spa';
  }> = [];

  if (rawDescription && mappedLang) {
    descriptionEntries.push({
      description: rawDescription,
      language: mappedLang,
    });
  }

  const synonyms = parseVnAliases(row['alias']);
  const isAdult = adultVnIds.has(id);

  return {
    contentId: id,
    type: 'vn',
    title: {
      contentTitleNative: nativeTitle,
      contentTitleRomaji: romaji,
      contentTitleEnglish: english,
    },
    contentImage,
    coverImage: null,
    description: descriptionEntries,
    synonyms,
    genres: [],
    isAdult,
    isAdultImage,
  };
}

/**
 * Bulk-upsert a batch of VN documents into MongoDB and index into Meilisearch.
 */
async function flushVnBatch(
  batch: INormalizedVnMedia[],
  counters: IVndbDumpSyncCounters
): Promise<void> {
  if (batch.length === 0) return;

  const operations = batch.map((item) => ({
    updateOne: {
      filter: { type: 'vn', contentId: item.contentId },
      update: { $set: item },
      upsert: true,
    },
  }));

  await MediaBase.bulkWrite(operations, { ordered: false });
  counters.upserted += operations.length;

  const contentIds = batch.map((item) => item.contentId);
  const docsForIndex = await MediaBase.find({
    type: 'vn',
    contentId: { $in: contentIds },
  })
    .select('_id contentId title contentImage coverImage isAdult isAdultImage synonyms type')
    .lean();

  const indexDocuments = docsForIndex.map((doc) => ({
    _id: String(doc._id),
    contentId: doc.contentId,
    title: doc.title,
    contentImage: doc.contentImage,
    coverImage: doc.coverImage,
    isAdult: doc.isAdult,
    isAdultImage: (doc as { isAdultImage?: boolean }).isAdultImage ?? false,
    synonyms: doc.synonyms || [],
    type: doc.type,
  }));

  try {
    const indexBatchSize = getIndexBatchSize();
    for (let i = 0; i < indexDocuments.length; i += indexBatchSize) {
      await addDocuments('vn', indexDocuments.slice(i, i + indexBatchSize));
    }
  } catch (error) {
    console.warn('Meilisearch indexing warning (VNDB sync):', error);
  }
}

/**
 * Delete any `type: 'vn'` docs in MongoDB (with contentId matching VNDB pattern)
 * that are NOT in the allowedContentIds set, then remove from Meilisearch.
 */
async function cleanupOutOfScopeVns(
  allowedContentIds: Set<string>
): Promise<void> {
  const staleDocs = await MediaBase.find({
    type: 'vn',
    contentId: /^v\d+$/,
  })
    .select('_id contentId')
    .lean();

  const docsToDelete = staleDocs.filter(
    (doc) => !allowedContentIds.has(doc.contentId)
  );

  if (docsToDelete.length === 0) return;

  const staleContentIds = docsToDelete.map((doc) => doc.contentId);
  const staleIndexIds = docsToDelete.map((doc) => String(doc._id));
  const deleteBatchSize = getBatchSize();

  for (let i = 0; i < staleContentIds.length; i += deleteBatchSize) {
    await MediaBase.deleteMany({
      type: 'vn',
      contentId: { $in: staleContentIds.slice(i, i + deleteBatchSize) },
    });
  }

  try {
    const indexBatchSize = getIndexBatchSize();
    for (let i = 0; i < staleIndexIds.length; i += indexBatchSize) {
      await deleteDocuments('vn', staleIndexIds.slice(i, i + indexBatchSize));
    }
  } catch (error) {
    console.warn('Meilisearch cleanup warning (VNDB sync):', error);
  }

  console.log(
    `🧹 VNDB sync: removed ${docsToDelete.length} out-of-scope VN(s) from media/index`
  );
}

// ---------------------------------------------------------------------------
// Main sync process
// ---------------------------------------------------------------------------

async function runSyncProcess(
  trigger: VndbSyncTrigger,
  options: IStartVndbDumpSyncOptions
): Promise<void> {
  const counters: IVndbDumpSyncCounters = {
    scanned: 0,
    upserted: 0,
    skipped: 0,
    failed: 0,
  };

  const force = options.force === true;
  const tempBase = getTempBaseDir();
  const tempDir = path.join(tempBase, `vndb-dump-${Date.now()}`);
  const archivePath = path.join(tempDir, 'vndb-db-latest.tar.zst');

  let dumpFileName = '';

  try {
    // ------------------------------------------------------------------
    // 1. Check for new dump (change detection)
    // ------------------------------------------------------------------
    await touchLockAndProgress(
      'checking',
      'Checking for new VNDB dump',
      counters
    );

    dumpFileName = await getVndbDumpFileName();
    const previousState = await getStateDocument();

    if (!force && dumpFileName === previousState?.lastDumpFileName) {
      await finalizeRunSuccess(
        'No new VNDB dump available',
        counters,
        { lastDumpFileName: dumpFileName }
      );
      console.log(`🗂️  VNDB sync: dump unchanged (${dumpFileName}), skipping`);
      return;
    }

    // ------------------------------------------------------------------
    // 2. Download
    // ------------------------------------------------------------------
    await touchLockAndProgress(
      'downloading',
      `Downloading VNDB dump: ${dumpFileName}`,
      counters
    );

    await import('fs/promises').then((fsp) =>
      fsp.mkdir(tempDir, { recursive: true })
    );

    console.log(`⬇️  VNDB sync: downloading ${dumpFileName} to ${archivePath}`);
    await downloadVndbDump(archivePath);
    console.log(`✅ VNDB sync: download complete`);

    // ------------------------------------------------------------------
    // 3. Extract
    // ------------------------------------------------------------------
    await touchLockAndProgress(
      'extracting',
      'Extracting VNDB dump archive',
      counters
    );

    console.log(`📦 VNDB sync: extracting archive`);
    await extractVndbDump(archivePath, tempDir);

    // The dump extracts to a "db/" subdirectory
    const dbDir = path.join(tempDir, 'db');
    console.log(`✅ VNDB sync: extraction complete, db dir: ${dbDir}`);

    // ------------------------------------------------------------------
    // 4. Build adult VN id set
    // ------------------------------------------------------------------
    await touchLockAndProgress(
      'releases',
      'Scanning releases for adult content flags',
      counters
    );

    const { adultVnIds, japaneseVnIds } = await buildReleaseVnSets(dbDir, counters);

    await touchLockAndProgress(
      'releases',
      `Found ${japaneseVnIds.size} Japanese VNs (${adultVnIds.size} adult)`,
      counters
    );

    // ------------------------------------------------------------------
    // 5. Build title map
    // ------------------------------------------------------------------
    await touchLockAndProgress(
      'vn_titles',
      'Parsing VN titles',
      counters
    );

    const titleMap = await buildTitleMap(dbDir, counters);

    // ------------------------------------------------------------------
    // 6. Build image rating map
    // ------------------------------------------------------------------
    await touchLockAndProgress(
      'images',
      'Scanning cover image sexual ratings',
      counters
    );

    const imageRatingMap = await buildImageRatingMap(dbDir);

    // ------------------------------------------------------------------
    // 7. Stream vn table → normalize → batch upsert
    // ------------------------------------------------------------------
    await touchLockAndProgress(
      'vn',
      'Syncing VN entries to media collection',
      counters
    );

    const vnHeaders = await readHeaderFile(path.join(dbDir, 'vn.header'));
    const batchSize = getBatchSize();
    const vnBatch: INormalizedVnMedia[] = [];
    const allowedVnContentIds = new Set<string>();

    for await (const row of streamTsvRows(path.join(dbDir, 'vn'), vnHeaders)) {
      counters.scanned += 1;

      const normalized = normalizeVnRow(row, adultVnIds, japaneseVnIds, imageRatingMap, titleMap);

      if (!normalized) {
        counters.skipped += 1;
        continue;
      }

      allowedVnContentIds.add(normalized.contentId);
      vnBatch.push(normalized);

      if (vnBatch.length >= batchSize) {
        const chunk = vnBatch.splice(0, vnBatch.length);
        await flushVnBatch(chunk, counters);
        await touchLockAndProgress(
          'vn',
          `Processed ${counters.scanned.toLocaleString()} rows, upserted ${counters.upserted.toLocaleString()}`,
          counters
        );
      }
    }

    // Flush remainder
    if (vnBatch.length > 0) {
      await flushVnBatch(vnBatch.splice(0, vnBatch.length), counters);
    }

    // ------------------------------------------------------------------
    // 7. Cleanup stale documents
    // ------------------------------------------------------------------
    await touchLockAndProgress(
      'cleanup',
      'Removing out-of-scope VN entries',
      counters
    );

    await cleanupOutOfScopeVns(allowedVnContentIds);

    // ------------------------------------------------------------------
    // 8. Finalize
    // ------------------------------------------------------------------
    await finalizeRunSuccess('VNDB dump sync completed', counters, {
      lastDumpFileName: dumpFileName,
    });

    console.log(
      `✅ VNDB dump sync complete (${trigger}) — scanned: ${counters.scanned}, upserted: ${counters.upserted}, skipped: ${counters.skipped}, failed: ${counters.failed}`
    );
  } finally {
    // Always clean up the temp directory
    await cleanupDumpDir(tempDir);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getVndbDumpSyncStatus(): Promise<IVndbDumpSyncStatusResponse> {
  const state = await getStateDocument();
  return mapStateToStatus(state);
}

export async function startVndbDumpSync(
  trigger: VndbSyncTrigger,
  options: IStartVndbDumpSyncOptions = {}
): Promise<IStartVndbDumpSyncResult> {
  const runLabel = options.force ? 'force VNDB dump sync' : 'VNDB dump sync';

  if (activeSyncPromise) {
    return {
      started: false,
      message: `${runLabel} is already running`,
      status: await getVndbDumpSyncStatus(),
    };
  }

  const lockState = await acquireLock(trigger);

  if (!lockState) {
    return {
      started: false,
      message: `${runLabel} is already running`,
      status: await getVndbDumpSyncStatus(),
    };
  }

  activeSyncPromise = runSyncProcess(trigger, options)
    .catch(async (error) => {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown VNDB sync error';
      const status = await getVndbDumpSyncStatus();
      await finalizeRunFailure(errorMessage, status.counters);
      console.error('VNDB dump sync failed:', error);
    })
    .finally(() => {
      activeSyncPromise = null;
    });

  return {
    started: true,
    message: options.force
      ? 'Force VNDB dump sync started'
      : 'VNDB dump sync started',
    status: mapStateToStatus(lockState),
  };
}

export function isVndbDumpSyncRunningInProcess(): boolean {
  return activeSyncPromise !== null;
}
