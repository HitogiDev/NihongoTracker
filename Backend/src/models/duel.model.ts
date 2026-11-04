import { Schema, model } from 'mongoose';
import { DUEL_METRICS, DUEL_STATUSES, IDuel } from '../types.js';
import { isValidGoalMediaType } from '../services/goalMediaType.js';

const DuelSchema = new Schema<IDuel>(
  {
    challenger: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    opponent: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    metric: { type: String, enum: DUEL_METRICS, required: true },
    target: { type: Number, required: true, min: 1 },
    mediaType: {
      type: String,
      default: null,
      validate: {
        validator: (value: string | null) =>
          value === null || isValidGoalMediaType(value),
        message: 'Invalid duel media type',
      },
    },
    durationDays: { type: Number, required: true, min: 1, max: 90 },
    status: {
      type: String,
      enum: DUEL_STATUSES,
      default: 'pending',
      required: true,
    },
    startDate: { type: Date },
    endDate: { type: Date },
    acceptedAt: { type: Date },
    winner: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    isDraw: { type: Boolean, default: false },
    finishedAt: { type: Date },
    rematchOf: { type: Schema.Types.ObjectId, ref: 'Duel', default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

DuelSchema.path('endDate').validate(function validateEndDate(
  endDate: Date | undefined
) {
  return !endDate || !this.startDate || endDate > this.startDate;
}, 'Duel end date must be after its start date');

DuelSchema.index({ challenger: 1, status: 1, endDate: 1 });
DuelSchema.index({ opponent: 1, status: 1, endDate: 1 });
DuelSchema.index({ status: 1, endDate: 1 });
DuelSchema.index({ status: 1, expiresAt: 1 });

export default model<IDuel>('Duel', DuelSchema);
