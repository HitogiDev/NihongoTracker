import type { ILog } from '../types.js';

export const goalMediaTypes: ILog['type'][] = [
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

export function isValidGoalMediaType(value: unknown): value is ILog['type'] {
  return (
    typeof value === 'string' && goalMediaTypes.includes(value as ILog['type'])
  );
}
