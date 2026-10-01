import type { GoalMediaType } from '../types';

export const goalMediaTypes: GoalMediaType[] = [
  'light-novel',
  'reading',
  'anime',
  'vn',
  'video',
  'manga',
  'audio',
  'movie',
  'tv show',
  'game',
  'book'
];

export const goalMediaTypeKey = (mediaType: GoalMediaType) =>
  mediaType === 'tv show' ? 'tvShow' : mediaType;
