import { Schema, model } from 'mongoose';

export const IGDB_DUMP_ENDPOINTS = ['games', 'genres', 'platforms'] as const;

export type IgdbDumpEndpoint = (typeof IGDB_DUMP_ENDPOINTS)[number];

export const IGDB_DUMP_SYNC_STATE_ID = 'igdb-dump-sync';

export interface IIgdbDumpEndpointState {
  fileName: string;
  updatedAt: number | null;
  schemaVersion: string;
  sizeBytes: number;
  processedAt: Date | null;
}

export interface IIgdbDumpSyncCounters {
  scanned: number;
  upserted: number;
  skipped: number;
  failed: number;
}

export interface IIgdbDumpSyncState {
  _id: string;
  isRunning: boolean;
  lockUntil: Date | null;
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
  createdAt?: Date;
  updatedAt?: Date;
}

const DumpEndpointStateSchema = new Schema<IIgdbDumpEndpointState>(
  {
    fileName: { type: String, default: '' },
    updatedAt: { type: Number, default: null },
    schemaVersion: { type: String, default: '' },
    sizeBytes: { type: Number, default: 0 },
    processedAt: { type: Date, default: null },
  },
  { _id: false }
);

const DumpCountersSchema = new Schema<IIgdbDumpSyncCounters>(
  {
    scanned: { type: Number, default: 0 },
    upserted: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
  { _id: false }
);

const IgdbDumpSyncStateSchema = new Schema<IIgdbDumpSyncState>(
  {
    _id: { type: String, default: IGDB_DUMP_SYNC_STATE_ID },
    isRunning: { type: Boolean, default: false },
    lockUntil: { type: Date, default: null },
    currentPhase: { type: String, default: '' },
    currentMessage: { type: String, default: '' },
    lastTrigger: {
      type: String,
      enum: ['manual', 'scheduled', 'unknown'],
      default: 'unknown',
    },
    lastStartedAt: { type: Date, default: null },
    lastFinishedAt: { type: Date, default: null },
    lastSuccessfulAt: { type: Date, default: null },
    lastFailedAt: { type: Date, default: null },
    lastError: { type: String, default: '' },
    counters: { type: DumpCountersSchema, default: () => ({}) },
    dumps: {
      games: { type: DumpEndpointStateSchema, default: () => ({}) },
      genres: { type: DumpEndpointStateSchema, default: () => ({}) },
      platforms: { type: DumpEndpointStateSchema, default: () => ({}) },
    },
  },
  { timestamps: true }
);

export default model<IIgdbDumpSyncState>(
  'IgdbDumpSyncState',
  IgdbDumpSyncStateSchema
);
