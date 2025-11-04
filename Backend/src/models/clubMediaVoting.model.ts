import { Schema, model, Document, Types } from 'mongoose';
import { IClubMediaCandidate } from '../types.js';

type VotingStatus =
  | 'setup'
  | 'suggestions_open'
  | 'suggestions_closed'
  | 'voting_open'
  | 'voting_closed'
  | 'completed';

type CandidateSubmissionType = 'manual' | 'member_suggestions';

type MediaType =
  | 'anime'
  | 'manga'
  | 'reading'
  | 'vn'
  | 'video'
  | 'movie'
  | 'custom';

export interface IClubMediaVotingDocument extends Document {
  club: Types.ObjectId;
  title: string;
  description?: string;
  mediaType: MediaType;
  customMediaType?: string;
  candidateSubmissionType: CandidateSubmissionType;
  suggestionStartDate?: Date;
  suggestionEndDate?: Date;
  votingStartDate: Date;
  votingEndDate: Date;
  consumptionStartDate: Date;
  consumptionEndDate: Date;
  status: VotingStatus;
  isActive: boolean;
  createdBy: Types.ObjectId;
  candidates: IClubMediaCandidate[];
  winnerCandidate?: {
    mediaId: string;
    title: string;
    description?: string;
    image?: string;
  };
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const ClubMediaVotingSchema = new Schema<IClubMediaVotingDocument>(
  {
    club: {
      type: Schema.Types.ObjectId,
      ref: 'Club',
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    description: { type: String },
    mediaType: {
      type: String,
      enum: ['anime', 'manga', 'reading', 'vn', 'video', 'movie', 'custom'],
      required: true,
    },
    customMediaType: { type: String },
    candidateSubmissionType: {
      type: String,
      enum: ['manual', 'member_suggestions'],
      required: true,
    },
    suggestionStartDate: { type: Date },
    suggestionEndDate: { type: Date },
    votingStartDate: { type: Date, required: true },
    votingEndDate: { type: Date, required: true },
    consumptionStartDate: { type: Date, required: true },
    consumptionEndDate: { type: Date, required: true },
    status: {
      type: String,
      enum: [
        'setup',
        'suggestions_open',
        'suggestions_closed',
        'voting_open',
        'voting_closed',
        'completed',
      ],
      default: 'setup',
      index: true,
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    candidates: [
      {
        mediaId: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String },
        image: { type: String },
        addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        addedAt: { type: Date, default: Date.now },
        votes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        isAdult: { type: Boolean, default: false },
      },
    ],
    winnerCandidate: {
      mediaId: { type: String },
      title: { type: String },
      description: { type: String },
      image: { type: String },
    },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

ClubMediaVotingSchema.index({ club: 1, status: 1 });
ClubMediaVotingSchema.index({ club: 1, consumptionStartDate: 1 });

export const ClubMediaVoting = model<IClubMediaVotingDocument>(
  'ClubMediaVoting',
  ClubMediaVotingSchema
);
