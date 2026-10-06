import type { IMediaDocument } from '../types';

export type MediaStatus = NonNullable<IMediaDocument['mediaStatus']>;
export type StatusFilter = MediaStatus | 'unset';

export const MEDIA_STATUSES: MediaStatus[] = [
  'completed',
  'in_progress',
  'planning',
  'paused',
  'dropped',
];
export const STATUS_FILTERS: StatusFilter[] = [...MEDIA_STATUSES, 'unset'];

export function mediaSelectionKey(
  media: Pick<IMediaDocument, 'type' | 'contentId'>,
) {
  return `${media.type}:${media.contentId}`;
}

export function getMediaStatus(
  media: Pick<IMediaDocument, 'mediaStatus' | 'isCompleted'>,
): StatusFilter {
  return media.mediaStatus ?? (media.isCompleted ? 'completed' : 'unset');
}

export function parseStatusFilters(value: string | null): StatusFilter[] {
  if (value === null || value === 'all') return [...STATUS_FILTERS];
  const filters = [
    ...new Set(
      value
        .split(',')
        .filter((status): status is StatusFilter =>
          STATUS_FILTERS.includes(status as StatusFilter),
        ),
    ),
  ];
  return value && filters.length === 0 ? [...STATUS_FILTERS] : filters;
}

export async function runMediaBatch(
  items: IMediaDocument[],
  action: (media: IMediaDocument) => Promise<unknown>,
) {
  const succeeded: string[] = [];
  const failed: string[] = [];
  let firstError: unknown;
  // List entries share one document. Send writes in order to preserve earlier additions.
  for (const media of items) {
    try {
      await action(media);
      succeeded.push(mediaSelectionKey(media));
    } catch (error) {
      failed.push(mediaSelectionKey(media));
      firstError ??= error;
    }
  }
  return { succeeded, failed, firstError };
}
