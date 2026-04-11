import { Schema, model } from 'mongoose';
import { IClub, IClubMember, IClubMedia } from '../types.js';

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
    mediaId: { type: String },
    mediaType: {
      type: String,
      enum: ['anime', 'manga', 'reading', 'vn', 'video', 'movie', 'game'],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    votingId: { type: Schema.Types.ObjectId }, // Links to the voting that created this media
    votes: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        vote: { type: Number, min: 1, max: 5 }, // For voting on media selection
      },
    ],
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
    tags: [{ type: String, maxlength: 30 }], // For filtering (e.g., "beginner", "advanced", "anime-focused")
    memberLimit: { type: Number, default: 100 },
    rules: { type: String, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
    legacyMediaVotings: { type: [Schema.Types.Mixed], default: undefined },
    migratedMediaVotingsAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes for better performance
ClubSchema.index({ name: 'text', description: 'text' });
ClubSchema.index({ isPublic: 1, isActive: 1 });
ClubSchema.index({ totalXp: -1 });
ClubSchema.index({ 'members.user': 1 });

const Club = model<IClub>('Club', ClubSchema);

export { Club };
