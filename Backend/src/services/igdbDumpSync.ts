import csvtojson from 'csvtojson';
import IgdbDumpSyncState, {
  IGDB_DUMP_ENDPOINTS,
  IGDB_DUMP_SYNC_STATE_ID,
  IIgdbDumpEndpointState,
  IIgdbDumpSyncCounters,
  IIgdbDumpSyncState,
  IgdbDumpEndpoint,
} from '../models/igdbDumpSyncState.model.js';
import { MediaBase } from '../models/media.model.js';
import {
  getIgdbDumpDetails,
  getIgdbDumpList,
  getIgdbDumpStream,
  IIgdbDumpDetails,
} from './igdbDumpClient.js';
import { addDocuments } from './meilisearch/meiliSearch.js';

export type IgdbSyncTrigger = 'manual' | 'scheduled';

export interface IIgdbDumpSyncStatusResponse {
  isRunning: boolean;
  currentPhase: string;
  currentMessage: string;
  lastTrigger: 'manual' | 'scheduled' | 'unknown';
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastSuccessfulAt: Date | null;
  lastFailedAt: Date | null;
  lastError: string;
  counters: IIgdbDumpSyncCounters;
  dumps: {
    games: IIgdbDumpEndpointState;
    genres: IIgdbDumpEndpointState;
    platforms: IIgdbDumpEndpointState;
  };
  updatedAt: Date | null;
}

export interface IStartIgdbDumpSyncResult {
  started: boolean;
  message: string;
  status: IIgdbDumpSyncStatusResponse;
}

interface IStartIgdbDumpSyncOptions {
  force?: boolean;
}

interface INormalizedGameMedia {
  contentId: string;
  title: {
    contentTitleNative: string;
    contentTitleEnglish: string;
  };
  contentImage?: string;
  coverImage?: string;
  description?: Array<{ description: string; language: 'eng' }>;
  type: 'game';
  igdbId: number;
  igdbUpdatedAt: number;
  platforms: string[];
  genres: string[];
  synonyms: string[];
  isAdult: boolean;
}

let activeSyncPromise: Promise<void> | null = null;

function getConfiguredEndpoints(): IgdbDumpEndpoint[] {
  const raw = process.env.IGDB_DUMP_SYNC_ENDPOINTS?.trim();

  if (!raw) {
    return [...IGDB_DUMP_ENDPOINTS];
  }

  const valid = new Set<IgdbDumpEndpoint>(IGDB_DUMP_ENDPOINTS);
  const configured = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is IgdbDumpEndpoint =>
      valid.has(item as IgdbDumpEndpoint)
    );

  if (configured.length === 0) {
    return [...IGDB_DUMP_ENDPOINTS];
  }

  return Array.from(new Set(configured));
}

function getBatchSize(): number {
  const raw = Number.parseInt(
    process.env.IGDB_DUMP_SYNC_BATCH_SIZE || '250',
    10
  );
  if (!Number.isFinite(raw) || raw < 1) {
    return 250;
  }
  return Math.min(raw, 5000);
}

function getIndexBatchSize(): number {
  const raw = Number.parseInt(
    process.env.IGDB_DUMP_SYNC_INDEX_BATCH_SIZE || '100',
    10
  );

  if (!Number.isFinite(raw) || raw < 1) {
    return 100;
  }

  return Math.min(raw, 1000);
}

function getLockDurationMs(): number {
  const minutes = Number.parseInt(
    process.env.IGDB_DUMP_SYNC_LOCK_MINUTES || '360',
    10
  );

  if (!Number.isFinite(minutes) || minutes < 5) {
    return 360 * 60 * 1000;
  }

  return minutes * 60 * 1000;
}

function defaultEndpointState(): IIgdbDumpEndpointState {
  return {
    fileName: '',
    updatedAt: null,
    schemaVersion: '',
    sizeBytes: 0,
    processedAt: null,
  };
}

function defaultStatus(): IIgdbDumpSyncStatusResponse {
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
    counters: {
      scanned: 0,
      upserted: 0,
      skipped: 0,
      failed: 0,
    },
    dumps: {
      games: defaultEndpointState(),
      genres: defaultEndpointState(),
      platforms: defaultEndpointState(),
    },
    updatedAt: null,
  };
}

function mapStateToStatus(
  state: IIgdbDumpSyncState | null
): IIgdbDumpSyncStatusResponse {
  if (!state) {
    return defaultStatus();
  }

  const dumps = state.dumps || {
    games: defaultEndpointState(),
    genres: defaultEndpointState(),
    platforms: defaultEndpointState(),
  };

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
    counters: state.counters,
    dumps,
    updatedAt: state.updatedAt || null,
  };
}

async function getStateDocument(): Promise<IIgdbDumpSyncState | null> {
  return await IgdbDumpSyncState.findById(IGDB_DUMP_SYNC_STATE_ID)
    .lean<IIgdbDumpSyncState>()
    .exec();
}

async function updateState(
  update: Record<string, unknown>
): Promise<IIgdbDumpSyncState | null> {
  return await IgdbDumpSyncState.findByIdAndUpdate(
    IGDB_DUMP_SYNC_STATE_ID,
    update,
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  )
    .lean<IIgdbDumpSyncState>()
    .exec();
}

async function acquireLock(
  trigger: IgdbSyncTrigger
): Promise<IIgdbDumpSyncState | null> {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + getLockDurationMs());

  return await IgdbDumpSyncState.findOneAndUpdate(
    {
      _id: IGDB_DUMP_SYNC_STATE_ID,
      $or: [
        { lockUntil: { $lte: now } },
        { lockUntil: null },
        { lockUntil: { $exists: false } },
      ],
    },
    {
      $setOnInsert: {
        _id: IGDB_DUMP_SYNC_STATE_ID,
      },
      $set: {
        isRunning: true,
        lockUntil,
        lastTrigger: trigger,
        lastStartedAt: now,
        currentPhase: 'initializing',
        currentMessage: 'Starting IGDB dump sync',
        lastError: '',
        counters: {
          scanned: 0,
          upserted: 0,
          skipped: 0,
          failed: 0,
        },
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  )
    .lean<IIgdbDumpSyncState>()
    .exec();
}

async function touchLockAndProgress(
  phase: string,
  message: string,
  counters: IIgdbDumpSyncCounters,
  additionalSet: Record<string, unknown> = {}
) {
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
  counters: IIgdbDumpSyncCounters,
  dumpsPatch: Record<string, unknown>
) {
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
      ...dumpsPatch,
    },
  });
}

async function finalizeRunFailure(
  errorMessage: string,
  counters: IIgdbDumpSyncCounters
) {
  const now = new Date();

  await updateState({
    $set: {
      isRunning: false,
      lockUntil: null,
      currentPhase: 'error',
      currentMessage: 'IGDB dump sync failed',
      lastFinishedAt: now,
      lastFailedAt: now,
      lastError: errorMessage,
      counters,
    },
  });
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === 'null') return null;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

function parseStringArray(value: unknown): string[] {
  if (value === null || value === undefined) return [];

  const raw = String(value).trim();

  if (!raw || raw.toLowerCase() === 'null' || raw === '[]' || raw === '{}') {
    return [];
  }

  const normalized =
    raw.startsWith('{') && raw.endsWith('}') ? `[${raw.slice(1, -1)}]` : raw;

  try {
    const parsed = JSON.parse(normalized);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0 && item.toLowerCase() !== 'null');
    }
  } catch {
    // Fall back to delimiter parsing below
  }

  return raw
    .replace(/[{}\[\]"]/g, '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.toLowerCase() !== 'null');
}

function parseNumberArray(value: unknown): number[] {
  return parseStringArray(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function normalizeRowKeys(
  row: Record<string, unknown>
): Record<string, string> {
  const result: Record<string, string> = {};

  Object.entries(row).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      result[key.toLowerCase()] = String(value);
    }
  });

  return result;
}

function pickField(row: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }

  return null;
}

function isLikelyImageId(value: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(value) && !/^\d+$/.test(value);
}

function buildImageUrl(imageId: string, size: string = 'cover_big'): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

function normalizeGameRow(
  sourceRow: Record<string, unknown>,
  genreNameById: Map<number, string>,
  platformNameById: Map<number, string>
): INormalizedGameMedia | null {
  const row = normalizeRowKeys(sourceRow);

  const idValue = pickField(row, ['id']);
  const nameValue = pickField(row, ['name']);

  if (!idValue || !nameValue) {
    return null;
  }

  const id = Number(idValue);
  if (!Number.isFinite(id)) {
    return null;
  }

  const updatedAt =
    parseNumber(pickField(row, ['updated_at', 'updatedat'])) || 0;

  const genreIds = parseNumberArray(pickField(row, ['genres']));
  const platformIds = parseNumberArray(pickField(row, ['platforms']));
  const themes = parseNumberArray(pickField(row, ['themes']));

  const genres = genreIds
    .map((genreId) => genreNameById.get(genreId) || '')
    .filter((name) => name.length > 0);

  const platforms = platformIds
    .map((platformId) => platformNameById.get(platformId) || '')
    .filter((name) => name.length > 0);

  const summary = pickField(row, ['summary', 'storyline', 'description']);

  const alternatives = parseStringArray(
    pickField(row, ['alternative_names_text', 'alternative_names'])
  ).filter((item) => !/^\d+$/.test(item));

  const coverImageId = pickField(row, [
    'cover_image_id',
    'cover.image_id',
    'coverimageid',
  ]);
  const screenshotImageId = pickField(row, [
    'screenshot_image_id',
    'screenshots_image_id',
    'screenshots.image_id',
    'screenshotimageid',
  ]);

  const contentImage =
    coverImageId && isLikelyImageId(coverImageId)
      ? buildImageUrl(coverImageId)
      : undefined;

  const coverImage =
    screenshotImageId && isLikelyImageId(screenshotImageId)
      ? buildImageUrl(screenshotImageId, '720p')
      : undefined;

  const isAdult =
    String(pickField(row, ['is_adult', 'adult']) || '').toLowerCase() ===
      'true' || themes.includes(42);

  const normalized: INormalizedGameMedia = {
    contentId: `igdb-${id}`,
    title: {
      contentTitleNative: nameValue,
      contentTitleEnglish: nameValue,
    },
    type: 'game',
    igdbId: id,
    igdbUpdatedAt: updatedAt,
    platforms,
    genres,
    synonyms: alternatives,
    isAdult,
  };

  if (summary && summary.toLowerCase() !== 'null') {
    normalized.description = [
      {
        description: summary,
        language: 'eng',
      },
    ];
  }

  if (contentImage) {
    normalized.contentImage = contentImage;
  }

  if (coverImage) {
    normalized.coverImage = coverImage;
  }

  return normalized;
}

async function streamDumpRows(
  dump: IIgdbDumpDetails,
  onRow: (row: Record<string, unknown>) => Promise<void>
): Promise<void> {
  const stream = await getIgdbDumpStream(dump.s3_url);

  await new Promise<void>((resolve, reject) => {
    let isSettled = false;

    const settle = (error?: unknown) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      converter.removeListener('done', onDone);
      converter.removeListener('error', onError);
      stream.removeListener('error', onError);

      if (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }

      resolve();
    };

    const onDone = (error?: unknown) => settle(error);
    const onError = (error: unknown) => settle(error);

    const converter = csvtojson({
      trim: true,
      needEmitAll: false,
    });

    converter.on('done', onDone);
    converter.on('error', onError);
    stream.on('error', onError);

    converter
      .subscribe(async (jsonRow) => {
        await onRow(jsonRow as Record<string, unknown>);
      }, onError)
      .fromStream(stream);
  });
}

async function buildNameMapFromDump(
  dump: IIgdbDumpDetails,
  counters: IIgdbDumpSyncCounters,
  label: 'genres' | 'platforms'
): Promise<Map<number, string>> {
  const namesById = new Map<number, string>();

  await streamDumpRows(dump, async (row) => {
    counters.scanned += 1;

    const normalizedRow = normalizeRowKeys(row);
    const id = parseNumber(pickField(normalizedRow, ['id']));
    const name = pickField(normalizedRow, ['name']);

    if (!id || !name) {
      counters.failed += 1;
      return;
    }

    namesById.set(id, name);
  });

  console.log(`✅ Parsed ${namesById.size} ${label} entries from dump`);

  return namesById;
}

async function flushGameBatch(
  batch: INormalizedGameMedia[],
  counters: IIgdbDumpSyncCounters
) {
  if (batch.length === 0) {
    return;
  }

  const contentIds = batch.map((item) => item.contentId);

  const existing = await MediaBase.find({
    type: 'game',
    contentId: { $in: contentIds },
  })
    .select('_id contentId igdbUpdatedAt')
    .lean();

  const existingByContentId = new Map(
    existing.map((doc) => [doc.contentId, doc])
  );

  const operations: Array<{
    updateOne: {
      filter: Record<string, unknown>;
      update: Record<string, unknown>;
      upsert: true;
    };
  }> = [];

  const contentIdsToIndex: string[] = [];

  batch.forEach((item) => {
    const current = existingByContentId.get(item.contentId) as
      | { igdbUpdatedAt?: number }
      | undefined;

    const currentUpdatedAt =
      typeof current?.igdbUpdatedAt === 'number' ? current.igdbUpdatedAt : 0;
    const incomingUpdatedAt = item.igdbUpdatedAt || 0;

    if (
      current &&
      incomingUpdatedAt > 0 &&
      currentUpdatedAt >= incomingUpdatedAt
    ) {
      counters.skipped += 1;
      return;
    }

    if (current && incomingUpdatedAt === 0) {
      counters.skipped += 1;
      return;
    }

    operations.push({
      updateOne: {
        filter: {
          type: 'game',
          contentId: item.contentId,
        },
        update: {
          $set: item,
        },
        upsert: true,
      },
    });

    contentIdsToIndex.push(item.contentId);
  });

  if (operations.length === 0) {
    return;
  }

  await MediaBase.bulkWrite(operations, { ordered: false });
  counters.upserted += operations.length;

  const docsForIndex = await MediaBase.find({
    type: 'game',
    contentId: { $in: contentIdsToIndex },
  })
    .select('_id contentId title contentImage coverImage isAdult synonyms type')
    .lean();

  const indexDocuments = docsForIndex.map((doc) => ({
    _id: String(doc._id),
    contentId: doc.contentId,
    title: doc.title,
    contentImage: doc.contentImage,
    coverImage: doc.coverImage,
    isAdult: doc.isAdult,
    synonyms: doc.synonyms || [],
    type: doc.type,
  }));

  try {
    const indexBatchSize = getIndexBatchSize();

    for (
      let index = 0;
      index < indexDocuments.length;
      index += indexBatchSize
    ) {
      await addDocuments(
        'game',
        indexDocuments.slice(index, index + indexBatchSize)
      );
    }
  } catch (error) {
    console.warn('Meilisearch indexing warning (IGDB sync):', error);
  }
}

function didDumpChange(
  previous: IIgdbDumpEndpointState,
  current: IIgdbDumpDetails
): boolean {
  return (
    previous.fileName !== current.file_name ||
    previous.updatedAt !== current.updated_at ||
    previous.schemaVersion !== current.schema_version
  );
}

async function runSyncProcess(
  trigger: IgdbSyncTrigger,
  options: IStartIgdbDumpSyncOptions
) {
  const counters: IIgdbDumpSyncCounters = {
    scanned: 0,
    upserted: 0,
    skipped: 0,
    failed: 0,
  };

  const configuredEndpoints = getConfiguredEndpoints();
  const force = options.force === true;

  await touchLockAndProgress(
    'metadata',
    'Fetching IGDB dump metadata',
    counters
  );

  const availableDumpList = await getIgdbDumpList();
  const availableEndpoints = new Set(
    availableDumpList.map((item) => item.endpoint)
  );

  const endpointsToFetch = configuredEndpoints.filter((endpoint) =>
    availableEndpoints.has(endpoint)
  );

  const missingEndpoints = configuredEndpoints.filter(
    (endpoint) => !availableEndpoints.has(endpoint)
  );

  if (missingEndpoints.length > 0) {
    console.warn(
      `Missing IGDB dump endpoint metadata for: ${missingEndpoints.join(', ')}`
    );
  }

  const dumpDetailsEntries = await Promise.all(
    endpointsToFetch.map(async (endpoint) => {
      const details = await getIgdbDumpDetails(endpoint);
      return [endpoint, details] as const;
    })
  );

  const dumpDetails = Object.fromEntries(dumpDetailsEntries) as Record<
    IgdbDumpEndpoint,
    IIgdbDumpDetails
  >;

  const previousState = await getStateDocument();
  const previousDumps = previousState?.dumps || {
    games: defaultEndpointState(),
    genres: defaultEndpointState(),
    platforms: defaultEndpointState(),
  };

  const changedEndpoints = configuredEndpoints.filter((endpoint) => {
    const details = dumpDetails[endpoint];
    if (!details) return false;
    if (force) return true;

    return didDumpChange(previousDumps[endpoint], details);
  });

  if (changedEndpoints.length === 0) {
    await finalizeRunSuccess(
      'No new IGDB dump updates available',
      counters,
      {}
    );
    return;
  }

  const shouldProcessGames = changedEndpoints.includes('games');

  let genreNameById = new Map<number, string>();
  let platformNameById = new Map<number, string>();

  if (
    dumpDetails.genres &&
    (shouldProcessGames || changedEndpoints.includes('genres'))
  ) {
    await touchLockAndProgress('genres', 'Parsing genres dump', counters);
    genreNameById = await buildNameMapFromDump(
      dumpDetails.genres,
      counters,
      'genres'
    );
  }

  if (
    dumpDetails.platforms &&
    (shouldProcessGames || changedEndpoints.includes('platforms'))
  ) {
    await touchLockAndProgress('platforms', 'Parsing platforms dump', counters);
    platformNameById = await buildNameMapFromDump(
      dumpDetails.platforms,
      counters,
      'platforms'
    );
  }

  if (shouldProcessGames) {
    await touchLockAndProgress(
      'games',
      'Syncing games dump to media collection',
      counters
    );

    const gameBatch: INormalizedGameMedia[] = [];
    const batchSize = getBatchSize();

    await streamDumpRows(dumpDetails.games, async (row) => {
      counters.scanned += 1;

      const normalized = normalizeGameRow(row, genreNameById, platformNameById);
      if (!normalized) {
        counters.failed += 1;
        return;
      }

      gameBatch.push(normalized);

      if (gameBatch.length >= batchSize) {
        const chunk = gameBatch.splice(0, gameBatch.length);
        await flushGameBatch(chunk, counters);

        await touchLockAndProgress(
          'games',
          `Processed ${counters.scanned} rows`,
          counters
        );
      }
    });

    if (gameBatch.length > 0) {
      await flushGameBatch(gameBatch.splice(0, gameBatch.length), counters);
    }
  }

  const processedAt = new Date();
  const dumpsPatch: Record<string, unknown> = {};

  configuredEndpoints.forEach((endpoint) => {
    const details = dumpDetails[endpoint];
    if (!details) return;

    const shouldSetProcessedAt =
      changedEndpoints.includes(endpoint) ||
      (shouldProcessGames &&
        (endpoint === 'genres' || endpoint === 'platforms'));

    dumpsPatch[`dumps.${endpoint}`] = {
      fileName: details.file_name,
      updatedAt: details.updated_at,
      schemaVersion: details.schema_version,
      sizeBytes: details.size_bytes || 0,
      processedAt: shouldSetProcessedAt
        ? processedAt
        : previousDumps[endpoint]?.processedAt || null,
    };
  });

  await finalizeRunSuccess('IGDB dump sync completed', counters, dumpsPatch);

  console.log(
    `✅ IGDB dump sync complete (${trigger}) - scanned: ${counters.scanned}, upserted: ${counters.upserted}, skipped: ${counters.skipped}, failed: ${counters.failed}`
  );
}

export async function getIgdbDumpSyncStatus(): Promise<IIgdbDumpSyncStatusResponse> {
  const state = await getStateDocument();
  return mapStateToStatus(state);
}

export async function startIgdbDumpSync(
  trigger: IgdbSyncTrigger,
  options: IStartIgdbDumpSyncOptions = {}
): Promise<IStartIgdbDumpSyncResult> {
  if (activeSyncPromise) {
    return {
      started: false,
      message: 'IGDB dump sync is already running',
      status: await getIgdbDumpSyncStatus(),
    };
  }

  const lockState = await acquireLock(trigger);

  if (!lockState) {
    return {
      started: false,
      message: 'IGDB dump sync is already running',
      status: await getIgdbDumpSyncStatus(),
    };
  }

  activeSyncPromise = runSyncProcess(trigger, options)
    .catch(async (error) => {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown IGDB sync error';
      const status = await getIgdbDumpSyncStatus();
      await finalizeRunFailure(errorMessage, status.counters);
      console.error('IGDB dump sync failed:', error);
    })
    .finally(() => {
      activeSyncPromise = null;
    });

  return {
    started: true,
    message: 'IGDB dump sync started',
    status: mapStateToStatus(lockState),
  };
}

export function isIgdbDumpSyncRunningInProcess(): boolean {
  return activeSyncPromise !== null;
}
