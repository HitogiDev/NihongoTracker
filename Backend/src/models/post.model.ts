import { Schema, model } from 'mongoose';
import {
  IPost,
  POST_BACKGROUND_PATTERNS,
  POST_BACKGROUND_TYPES,
  POST_BORDER_STYLES,
  POST_IMAGE_SOURCES,
  SOCIAL_VISIBILITIES,
} from '../types.js';

export const POST_CONTENT_MAX_LENGTH = 4000;
export const POST_IMAGES_MAX = 4;

const PostImageSchema = new Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    source: { type: String, enum: POST_IMAGE_SOURCES, required: true },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    // Hosted images count toward the upload quota from this date.
    uploadedAt: { type: Date },
  },
  { _id: true }
);

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const colorField = (fallback: string) => ({
  type: String,
  match: HEX_COLOR,
  default: fallback,
});

const PostDecorationSchema = new Schema(
  {
    border: {
      style: { type: String, enum: POST_BORDER_STYLES, default: 'none' },
      color1: colorField('#a855f7'),
      color2: colorField('#ec4899'),
    },
    background: {
      type: { type: String, enum: POST_BACKGROUND_TYPES, default: 'none' },
      color: colorField('#1e293b'),
      pattern: { type: String, enum: POST_BACKGROUND_PATTERNS, default: 'dots' },
      patternColor: colorField('#a855f7'),
      opacity: { type: Number, min: 0, max: 100, default: 100 },
      image: {
        type: new Schema(
          {
            url: { type: String, required: true, trim: true, maxlength: 2048 },
            source: { type: String, enum: POST_IMAGE_SOURCES, required: true },
            uploadedAt: { type: Date },
          },
          { _id: false }
        ),
        default: null,
      },
    },
  },
  { _id: false }
);

const PostSchema = new Schema<IPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: {
      type: String,
      trim: true,
      maxlength: POST_CONTENT_MAX_LENGTH,
      default: '',
    },
    images: {
      type: [PostImageSchema],
      default: [],
      validate: {
        validator: (images: unknown[]) => images.length <= POST_IMAGES_MAX,
        message: `A post can have at most ${POST_IMAGES_MAX} images`,
      },
    },
    visibility: {
      type: String,
      enum: SOCIAL_VISIBILITIES,
      default: 'public',
      required: true,
    },
    sensitive: { type: Boolean, default: false },
    decoration: { type: PostDecorationSchema, default: null },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PostSchema.index({ author: 1, createdAt: -1 });
PostSchema.index({ author: 1, 'images.uploadedAt': -1 });

export default model<IPost>('Post', PostSchema);
