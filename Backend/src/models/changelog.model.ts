import { Schema, model } from 'mongoose';
import { IChangelog } from '../types.js';

const ChangelogSchema = new Schema<IChangelog>(
  {
    version: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: false,
      trim: true,
    },
    changes: [
      {
        type: {
          type: String,
          enum: ['feature', 'improvement', 'bugfix', 'breaking'],
          required: true,
        },
        description: {
          type: String,
        },
      },
    ],
    date: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    published: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for sorting by date
ChangelogSchema.index({ date: -1 });

const Changelog = model<IChangelog>('Changelog', ChangelogSchema);

export default Changelog;
