import { Schema, model } from 'mongoose';
import {
  IAchievement,
  AchievementCategory,
  AchievementRarity,
  IAchievementCriteria,
} from '../types.js';

const AchievementCriteriaSchema = new Schema<IAchievementCriteria>(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'total_xp',
        'category_xp',
        'level_reached',
        'category_level',
        'streak_days',
        'total_logs',
        'category_logs',
        'episodes_watched',
        'pages_read',
        'chars_read',
        'hours_listened',
        'club_member',
        'club_owner',
      ],
    },
    category: {
      type: String,
      enum: ['reading', 'listening'],
      required: false,
    },
    threshold: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const AchievementSchema = new Schema<IAchievement>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      default: '🏆',
    },
    category: {
      type: String,
      required: true,
      enum: Object.values(AchievementCategory),
    },
    rarity: {
      type: String,
      required: true,
      enum: Object.values(AchievementRarity),
    },
    criteria: {
      type: AchievementCriteriaSchema,
      required: true,
    },
    points: {
      type: Number,
      required: true,
      default: 10,
    },
    hidden: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Achievement = model<IAchievement>('Achievement', AchievementSchema);

export default Achievement;
