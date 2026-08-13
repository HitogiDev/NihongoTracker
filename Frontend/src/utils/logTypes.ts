import type { ParseKeys } from 'i18next';
import type { ILog } from '../types';

/**
 * The log types offered by the create/quick log forms, in display order.
 *
 * Kept here rather than inline in each form: QuickLog and LogScreen drifted
 * apart once already and QuickLog silently lost the `book` type. The labels
 * are keys, not text, because this list is module scope.
 */
export const LOG_TYPE_OPTIONS: {
  value: NonNullable<ILog['type']>;
  labelKey: ParseKeys<'common'>;
}[] = [
  { value: 'anime', labelKey: 'mediaTypes.anime' },
  { value: 'manga', labelKey: 'mediaTypes.manga' },
  { value: 'vn', labelKey: 'mediaTypes.vn' },
  { value: 'game', labelKey: 'mediaTypes.game' },
  { value: 'video', labelKey: 'mediaTypes.video' },
  { value: 'tv show', labelKey: 'mediaTypes.tvShow' },
  { value: 'movie', labelKey: 'mediaTypes.movie' },
  { value: 'light-novel', labelKey: 'mediaTypes.light-novel' },
  { value: 'reading', labelKey: 'mediaTypes.reading' },
  { value: 'book', labelKey: 'mediaTypes.book' },
  { value: 'audio', labelKey: 'mediaTypes.audio' },
];

const LABEL_KEY_BY_TYPE = new Map(
  LOG_TYPE_OPTIONS.map(({ value, labelKey }) => [value, labelKey])
);

/** Translation key for a log type, for lists that build their own options. */
export function getLogTypeLabelKey(
  type: string
): ParseKeys<'common'> | undefined {
  return LABEL_KEY_BY_TYPE.get(type as NonNullable<ILog['type']>);
}
