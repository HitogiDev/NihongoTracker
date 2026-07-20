import { IMediaDocument } from '../types';

/** Preferred display title for a media document: English > Romaji > Native. */
export function getMediaDisplayTitle(media?: IMediaDocument | null): string {
  if (!media) return 'Unknown media';
  return (
    media.title?.contentTitleEnglish ||
    media.title?.contentTitleRomaji ||
    media.title?.contentTitleNative ||
    'Unknown media'
  );
}
