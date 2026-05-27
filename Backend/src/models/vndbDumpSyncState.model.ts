import { Schema, model } from 'mongoose';

export const VNDB_DUMP_SYNC_STATE_ID = 'vndb-dump-sync';

export interface IVndbDumpSyncCounters {
  scanned: number;
  upserted: number;
  skipped: number;
  failed: number;
}

export interface IVndbDumpSyncState {
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
  lastDumpFileName: string;
  counters: IVndbDumpSyncCounters;
  createdAt?: Date;
  updatedAt?: Date;
}

const DumpCountersSchema = new Schema<IVndbDumpSyncCounters>(
  {
    scanned: { type: Number, default: 0 },
    upserted: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
  { _id: false }
);

const VndbDumpSyncStateSchema = new Schema<IVndbDumpSyncState>(
  {
    _id: { type: String, default: VNDB_DUMP_SYNC_STATE_ID },
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
    lastDumpFileName: { type: String, default: '' },
    counters: { type: DumpCountersSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default model<IVndbDumpSyncState>(
  'VndbDumpSyncState',
  VndbDumpSyncStateSchema
);
