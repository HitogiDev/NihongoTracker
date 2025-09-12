import { Schema, model } from 'mongoose';
import { IClub, IClubMember, IClubMedia, IClubReview } from '../types.js';

// Club Member Schema
const ClubMemberSchema = new Schema<IClubMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      enum: ['leader', 'moderator', 'member'],
      default: 'member',
    },
    joinedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['active', 'pending', 'banned'],
      default: 'active',
    },
  },
  { _id: false }
);

// Club Media Schema (for club reading/watching challenges)
const ClubMediaSchema = new Schema<IClubMedia>(
  {
    mediaId: { type: String, required: true },
    mediaType: {
      type: String,
      enum: ['anime', 'manga', 'reading', 'vn', 'video', 'movie'],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    votes: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        vote: { type: Number, min: 1, max: 5 }, // For voting on media selection
      },
    ],
  },
  { timestamps: true }
);

// Club Media Voting Schema (redesigned for multi-step voting process)
const ClubMediaVotingSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    mediaType: {
      type: String,
      enum: ['anime', 'manga', 'reading', 'vn', 'video', 'movie', 'custom'],
      required: true,
    },
    customMediaType: { type: String }, // Used when mediaType is 'custom'

    // Voting configuration
    candidateSubmissionType: {
      type: String,
      enum: ['manual', 'member_suggestions'],
      required: true,
    },

    // Date periods
    suggestionStartDate: { type: Date }, // When members can start suggesting (only for member_suggestions)
    suggestionEndDate: { type: Date }, // When suggestions close (only for member_suggestions)
    votingStartDate: { type: Date, required: true },
    votingEndDate: { type: Date, required: true },
    consumptionStartDate: { type: Date, required: true },
    consumptionEndDate: { type: Date, required: true },

    // Status and management
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
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // Candidates for voting
    candidates: [
      {
        mediaId: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String },
        image: { type: String },
        addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        addedAt: { type: Date, default: Date.now },
        votes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      },
    ],

    // Results
    winnerCandidate: {
      mediaId: { type: String },
      title: { type: String },
      description: { type: String },
      image: { type: String },
    },
  },
  { timestamps: true }
);

// Club Review Schema
const ClubReviewSchema = new Schema<IClubReview>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clubMedia: { type: Schema.Types.ObjectId, required: true },
    content: { type: String, required: true, maxlength: 1000 },
    rating: { type: Number, min: 1, max: 5 },
    hasSpoilers: { type: Boolean, default: false },
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    editedAt: { type: Date },
  },
  { timestamps: true }
);

const ClubSchema = new Schema<IClub>(
  {
    name: { type: String, required: true, maxlength: 100 },
    description: { type: String, maxlength: 500 },
    avatar: { type: String }, // URL to club profile picture
    banner: { type: String }, // URL to club banner
    isPublic: { type: Boolean, default: true },
    level: { type: Number, default: 1 },
    totalXp: { type: Number, default: 0 },
    members: [ClubMemberSchema],
    currentMedia: [ClubMediaSchema],
    mediaVotings: [ClubMediaVotingSchema],
    tags: [{ type: String, maxlength: 30 }], // For filtering (e.g., "beginner", "advanced", "anime-focused")
    memberLimit: { type: Number, default: 100 },
    rules: { type: String, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes for better performance
ClubSchema.index({ name: 'text', description: 'text' });
ClubSchema.index({ isPublic: 1, isActive: 1 });
ClubSchema.index({ totalXp: -1 });
ClubSchema.index({ 'members.user': 1 });

const Club = model<IClub>('Club', ClubSchema);
const ClubReview = model<IClubReview>('ClubReview', ClubReviewSchema);

export { Club, ClubReview };
