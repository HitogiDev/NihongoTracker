import { Schema, model } from 'mongoose';
import { ILog, IEditedFields } from '../types.js';

const hasPositiveValue = (value?: number | null) =>
  typeof value === 'number' && value > 0;

const editedFieldsSchema = new Schema<IEditedFields>(
  {
    episodes: { type: Number },
    pages: { type: Number },
    chars: { type: Number },
    time: { type: Number },
    xp: { type: Number },
  },
  { _id: false }
);

const LogSchema = new Schema<ILog>(
  {
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    mediaTitle: { type: String, required: false, trim: true },
    type: {
      type: String,
      required: true,
      enum: [
        'reading',
        'anime',
        'vn',
        'video',
        'manga',
        'audio',
        'movie',
        'tv show',
        'other',
      ],
    },
    mediaId: {
      type: String,
      default: null,
    },
    manabeId: { type: String },
    xp: { type: Number, required: true },
    private: { type: Boolean, default: false },
    isAdult: { type: Boolean, default: false },
    description: {
      type: String,
      trim: true,
      required: true,
    },
    editedFields: { type: editedFieldsSchema, default: null },
    episodes: {
      type: Number,
      required: function (this: ILog) {
        return this.type === 'anime';
      },
      default: 1,
    },
    pages: {
      type: Number,
      required: function (this: ILog) {
        const hasChars = hasPositiveValue(this.chars);
        const hasTime = hasPositiveValue(this.time);
        return (
          (!hasChars && this.type === 'manga') ||
          (!hasChars && !hasTime && this.type === 'reading')
        );
      },
    },
    time: {
      type: Number,
      required: function (this: ILog) {
        const hasChars = hasPositiveValue(this.chars);
        const hasPages = hasPositiveValue(this.pages);
        return (
          (!hasChars &&
            ((this.type === 'reading' && !hasPages) || this.type === 'vn')) ||
          this.type === 'video' ||
          this.type === 'movie' ||
          this.type === 'audio' ||
          this.type === 'other'
        );
      },
    },
    chars: {
      type: Number,
      required: function (this: ILog) {
        const hasTime = hasPositiveValue(this.time);
        const hasPages = hasPositiveValue(this.pages);
        return (
          (!hasTime && this.type === 'vn') ||
          (!hasTime && !hasPages && this.type === 'reading') ||
          (!hasPages && this.type === 'manga')
        );
      },
    },
    date: { type: Date, default: () => new Date(), required: true },
    tags: [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
  },
  { timestamps: true }
);

LogSchema.virtual('media', {
  ref: 'Media',
  localField: 'mediaId',
  foreignField: 'contentId',
  justOne: true,
});

// NOTE: In production, indexes should be created via migration scripts
// rather than Mongoose schema definitions for better control and performance.
// See: npm run migrate:indexes:prod
//
// Development indexes (only active in development mode):
if (process.env.NODE_ENV === 'development') {
  LogSchema.index({ user: 1, date: -1 }); // For user logs sorted by date
  LogSchema.index({ user: 1, mediaId: 1, type: 1 }); // For specific media logs by user
  LogSchema.index({ user: 1, type: 1, date: -1 }); // For user logs by type sorted by date
  LogSchema.index({ mediaId: 1, type: 1, date: -1 }); // For media logs sorted by date
  LogSchema.index({ user: 1, private: 1, date: -1 }); // For filtering private logs
  LogSchema.index({ date: -1 }); // For recent logs across all users
  LogSchema.index({ user: 1, mediaId: 1, type: 1, date: -1 }); // Critical compound index
  LogSchema.index({ manabeId: 1 }, { sparse: true }); // For checking duplicate Manabe logs
}

export default model<ILog>('Log', LogSchema);
