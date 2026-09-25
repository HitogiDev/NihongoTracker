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
      enum: [
        'anime',
        'manga',
        'light-novel',
        'vn',
        'video',
        'movie',
        'tv show',
        'game',
        'book',
      ],
    },
    genres: { type: [String], default: [] },
    synonyms: { type: [String], default: [] },
    isAdult: { type: Boolean, default: false },
    isAdultImage: { type: Boolean, default: false },
    jitenDifficulty: { type: Number, default: null },
    jitenSyncedAt: { type: Date, default: null },
  },
  { discriminatorKey: 'type', collection: 'media' }
);

// NOTE: In production, indexes should be created via migration scripts
// rather than automatic creation, to avoid blocking on startup.
// See: npm run migrate:indexes:prod
//
// Development indexes (only active in development mode):
if (process.env.NODE_ENV === 'development') {
  // Backs the Jiten difficulty backfill scan (type + missing difficulty),
  // which would otherwise collection-scan every media doc including the
  // IGDB/VNDB dumps.
  MediaBaseSchema.index({ type: 1, jitenDifficulty: 1 });
}

const MediaBase = model<IMediaDocument>('Media', MediaBaseSchema);

const AnimeSchema = new Schema({
  episodes: { type: Number },
  episodeDuration: { type: Number },
  // AniList airing window. airingEndDate stays null while a show is still
  // airing (or when AniList has no end date yet).
  airingStartDate: { type: Date, default: null },
  airingEndDate: { type: Date, default: null },
});

const Anime = MediaBase.discriminator('anime', AnimeSchema);

const MangaSchema = new Schema({
  chapters: { type: Number, default: null },
  characters: { type: Number, default: null },
  volumes: { type: Number, default: null },
});

const Manga = MediaBase.discriminator('manga', MangaSchema);

// Light novels reuse the manga shape (chapters/characters/volumes). The
// discriminator value is 'light-novel'; the JS identifier stays `Reading`.
const Reading = MediaBase.discriminator('light-novel', MangaSchema);

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

const VideoGameSchema = new Schema({
  igdbUpdatedAt: { type: Number, default: 0 },
  platforms: { type: [String], default: [] },
});

const VideoGame = MediaBase.discriminator('game', VideoGameSchema);

/** isAdultImage: true when the cover image has a VNDB sexual avg >= 100 (suggestive+) */
const VnSchema = new Schema({
  characters: { type: Number, default: null },
  // Year of the VN's earliest known release, from the VNDB dump
  releaseYear: { type: Number, default: null },
});

const Vn = MediaBase.discriminator('vn', VnSchema);

const BookSchema = new Schema({
  pageCount: { type: Number, default: null },
  authors: { type: [String], default: [] },
  publishedDate: { type: String, default: null },
});

const Book = MediaBase.discriminator('book', BookSchema);

export {
  MediaBase,
  Anime,
  Manga,
  Reading,
  Video,
  Movie,
  TVShow,
  VideoGame,
  Vn,
  Book,
};
