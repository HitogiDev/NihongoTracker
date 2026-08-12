/**
 * The one place a media type's colour is defined.
 *
 * Charts read the hex; UI chrome reads the Tailwind classes below. Both must
 * stay in step, which is why they live in the same file — the classes cannot be
 * derived from the hex at runtime because Tailwind v4 scans source text and
 * would never generate an assembled `text-[${hex}]`.
 */
export const MEDIA_TYPE_COLORS: Record<string, string> = {
  vn: '#3a70e4',
  game: '#59c94e',
  anime: '#26b2f2',
  video: '#2cc9a4',
  'tv show': '#f8b420',
  manga: '#ee4466',
  reading: '#b34ce6',
  movie: '#f77118',
  book: '#7c6cf0',
  audio: '#f2a15a',
  // Grey, not the teal it used to be: "other" is the absence of a category,
  // and the old #10b785 sat right next to `video`'s teal on a stacked chart.
  other: '#6b7280',
};

export function getMediaTypeColor(mediaType: string): string {
  return MEDIA_TYPE_COLORS[mediaType] || MEDIA_TYPE_COLORS.other;
}

export interface MediaTypeClasses {
  /** Foreground for the icon and the type label. */
  color: string;
  /** Tinted fill behind the icon. */
  bgColor: string;
  /** Hairline around the tinted fill. */
  borderColor: string;
  /** Solid bar / dot marking the type. */
  accentColor: string;
}

const classesFor = (
  color: string,
  bgColor: string,
  borderColor: string,
  accentColor: string
): MediaTypeClasses => ({ color, bgColor, borderColor, accentColor });

export const MEDIA_TYPE_CLASSES: Record<string, MediaTypeClasses> = {
  vn: classesFor(
    'text-[#3a70e4]',
    'bg-[#3a70e4]/10',
    'border-[#3a70e4]/30',
    'bg-[#3a70e4]'
  ),
  game: classesFor(
    'text-[#59c94e]',
    'bg-[#59c94e]/10',
    'border-[#59c94e]/30',
    'bg-[#59c94e]'
  ),
  anime: classesFor(
    'text-[#26b2f2]',
    'bg-[#26b2f2]/10',
    'border-[#26b2f2]/30',
    'bg-[#26b2f2]'
  ),
  video: classesFor(
    'text-[#2cc9a4]',
    'bg-[#2cc9a4]/10',
    'border-[#2cc9a4]/30',
    'bg-[#2cc9a4]'
  ),
  'tv show': classesFor(
    'text-[#f8b420]',
    'bg-[#f8b420]/10',
    'border-[#f8b420]/30',
    'bg-[#f8b420]'
  ),
  manga: classesFor(
    'text-[#ee4466]',
    'bg-[#ee4466]/10',
    'border-[#ee4466]/30',
    'bg-[#ee4466]'
  ),
  reading: classesFor(
    'text-[#b34ce6]',
    'bg-[#b34ce6]/10',
    'border-[#b34ce6]/30',
    'bg-[#b34ce6]'
  ),
  movie: classesFor(
    'text-[#f77118]',
    'bg-[#f77118]/10',
    'border-[#f77118]/30',
    'bg-[#f77118]'
  ),
  book: classesFor(
    'text-[#7c6cf0]',
    'bg-[#7c6cf0]/10',
    'border-[#7c6cf0]/30',
    'bg-[#7c6cf0]'
  ),
  audio: classesFor(
    'text-[#f2a15a]',
    'bg-[#f2a15a]/10',
    'border-[#f2a15a]/30',
    'bg-[#f2a15a]'
  ),
  other: classesFor(
    'text-[#6b7280]',
    'bg-[#6b7280]/10',
    'border-[#6b7280]/30',
    'bg-[#6b7280]'
  ),
};

export function getMediaTypeClasses(mediaType: string): MediaTypeClasses {
  return MEDIA_TYPE_CLASSES[mediaType] || MEDIA_TYPE_CLASSES.other;
}
