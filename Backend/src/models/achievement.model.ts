import { Schema, model } from 'mongoose';
import { IAchievement } from '../types.js';

const ConditionSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'streak',
        'totalXp',
        'logCount',
        'mediaType',
        'level',
        'totalHours',
        'mediaTypeHours',
        'achievementCount',
        'logTimeRange',
        'logOnDate',
        'singleDayHours',
        'weeklyHours',
        'sessionsInDay',
        'platformAge',
        'clubsCreated',
        'clubMvp',
        'mediaTypesInWeek',
        'mediaReleasedBefore',
        'logDuringAiring',
        'clubsJoined',
        'distinctMediaCount',
        'consecutiveDaysWithHours',
        'singleSessionHours',
        'rapidSuccession',
        'streakComeback',
        'streakAfterBreak',
        'rankDethroned',
        'secretAchievementCount',
        'earlyAdopter',
        'manualGrant',
      ],
    },
    threshold:   { type: Number },
    mediaType:   { type: String },
    stat:        { type: String },
    startHour:   { type: Number },   // for logTimeRange
    endHour:     { type: Number },   // for logTimeRange
    datePattern: { type: String },   // for logOnDate — 'MM-DD' e.g. '07-07'
    year:        { type: Number },   // for mediaReleasedBefore
    days:        { type: Number },   // for mediaTypesInWeek — window size
    hours:       { type: Number },   // for consecutiveDaysWithHours
    seconds:     { type: Number },   // for rapidSuccession
  },
  { _id: false }
);

const AchievementSchema = new Schema<IAchievement>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    hint: { type: String, default: '' },
    category: {
      type: String,
      required: true,
      enum: ['streaks', 'immersion', 'social', 'milestone', 'secret'],
    },
    rarity: {
      type: String,
      required: true,
      enum: ['common', 'rare', 'epic', 'legendary', 'secret'],
    },
    iconSlug: { type: String, required: true, trim: true },
    isSecret: { type: Boolean, default: false },
    isHidden: { type: Boolean, default: false },
    condition: { type: ConditionSchema, required: true },
    points: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AchievementSchema.index({ key: 1 }, { unique: true });
AchievementSchema.index({ isActive: 1, category: 1 });
AchievementSchema.index({ rarity: 1, isActive: 1 });

export default model<IAchievement>('Achievement', AchievementSchema);
