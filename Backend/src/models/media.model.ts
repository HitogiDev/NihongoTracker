import { Schema, model } from 'mongoose';
import { IMediaDocument, IMediaTitle } from '../types.js';

const MediaTitle = new Schema<IMediaTitle>(
  {
    contentTitleNative: { type: String, required: true },
    contentTitleRomaji: { type: String, default: null },
    contentTitleEnglish: { type: String, default: null },
  },
  { _id: false }
);

const MediaBaseSchema = new Schema<IMediaDocument>(
  {
    title: { type: MediaTitle, required: true },
    contentId: { type: String, required: true, unique: true },
    contentImage: { type: String },
    coverImage: { type: String },
    description: [
      {
        description: { type: String },
        language: { type: String, enum: ['eng', 'jpn', 'spa'] },
      },
    ],
    type: {
      type: String,
      required: true,
      enum: ['anime', 'manga', 'reading', 'vn', 'video', 'movie', 'tv show'],
    },
    genres: { type: [String], default: [] },
    synonyms: { type: [String], default: [] },
    isAdult: { type: Boolean, default: false },
  },
  { discriminatorKey: 'type', collection: 'media' }
);

const MediaBase = model<IMediaDocument>('Media', MediaBaseSchema);

const AnimeSchema = new Schema({
  episodes: { type: Number },
  episodeDuration: { type: Number },
});

const Anime = MediaBase.discriminator('anime', AnimeSchema);

const MangaSchema = new Schema({
  chapters: { type: Number, default: null },
  volumes: { type: Number, default: null },
});

const Manga = MediaBase.discriminator('manga', MangaSchema);

const Reading = MediaBase.discriminator('reading', MangaSchema);

const VideoSchema = new Schema({
  // Empty - storing YouTube channels, not individual videos
});

const Video = MediaBase.discriminator('video', VideoSchema);

const MovieSchema = new Schema({
  runtime: { type: Number, default: null },
});

const Movie = MediaBase.discriminator('movie', MovieSchema);

const TVShowSchema = new Schema({
  episodes: { type: Number, default: null },
  episodeDuration: { type: Number, default: null },
  seasons: { type: Number, default: null },
});

const TVShow = MediaBase.discriminator('tv show', TVShowSchema);

export { MediaBase, Anime, Manga, Reading, Video, Movie, TVShow };
