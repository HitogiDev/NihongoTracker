export const MEDIA_TYPE_COLORS: Record<string, string> = {
  vn: '#3a70e4',
  game: '#59c94e',
  anime: '#26b2f2',
  video: '#2cc9a4',
  'tv show': '#f8b420',
  manga: '#ee4466',
  reading: '#b34ce6',
  movie: '#f77118',
  audio: '#f2a15a',
  other: '#10b785',
};

export function getMediaTypeColor(mediaType: string): string {
  return MEDIA_TYPE_COLORS[mediaType] || MEDIA_TYPE_COLORS.other;
}
