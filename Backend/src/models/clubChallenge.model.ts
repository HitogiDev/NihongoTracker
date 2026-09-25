import { Schema, model } from 'mongoose';
import {
  CLUB_CHALLENGE_METRICS,
  IClubChallenge,
} from '../types.js';

// Unified club objectives. `mode` distinguishes collective club goals from
// opt-in individual challenges while keeping one lifecycle and progress model.
const ClubChallengeSchema = new Schema<IClubChallenge>(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    club: { type: Schema.Types.ObjectId, ref: 'Club', default: null },
    mode: {
      type: String,
      enum: ['collective', 'individual'],
      default: 'individual',
      required: true,
    },
    period: {
      type: String,
      enum: ['weekly', 'monthly', 'custom', 'indefinite'],
      default: 'custom',
    },
    legacyGoalId: { type: Schema.Types.ObjectId, default: null },
    scope: {
      type: String,
      enum: ['global', 'official', 'club'],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    metric: { type: String, enum: CLUB_CHALLENGE_METRICS, required: true },
    goal: { type: Number, required: true, min: 1 },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    completedParticipants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    status: {
      type: String,
      enum: ['scheduled', 'active', 'completed', 'cancelled'],
      default: 'scheduled',
      required: true,
    },
    visibility: {
      type: String,
      enum: ['public', 'members'],
      default: 'public',
      required: true,
    },
  },
  { timestamps: true }
);

ClubChallengeSchema.path('endDate').validate(function validateEndDate(endDate: Date) {
  return endDate > this.startDate;
}, 'Challenge end date must be after its start date');

ClubChallengeSchema.index({ club: 1, status: 1, startDate: -1 });
ClubChallengeSchema.index({ scope: 1, visibility: 1, status: 1, startDate: -1 });
ClubChallengeSchema.index({ participants: 1, status: 1, endDate: 1 });
ClubChallengeSchema.index({ club: 1, legacyGoalId: 1 }, { sparse: true });

export default model<IClubChallenge>('ClubChallenge', ClubChallengeSchema);
