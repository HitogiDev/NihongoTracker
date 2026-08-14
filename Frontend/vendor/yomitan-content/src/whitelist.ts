/**
 * What this renderer will emit, and nothing else.
 *
 * The scope is closed deliberately: it comes from a census of all 435,448
 * Jitendex entries (see `SPIKE-hoshidicts.md`), which found 13 tags, 41
 * `data-sc-content` hooks, 12 `data-sc-class` hooks and exactly one inline style
 * property. Everything below 10 % of entries, plus tables and images, is out of
 * this iteration — not dropped, but rendered as its own contents and counted.
 */

/** Tags rendered as themselves. Anything else falls through to its children. */
export const SUPPORTED_TAGS = ['div', 'span', 'li', 'ul', 'ol', 'ruby', 'rt', 'a'] as const;
export type SupportedTag = (typeof SUPPORTED_TAGS)[number];

const SUPPORTED_TAG_SET = new Set<string>(SUPPORTED_TAGS);
export function isSupportedTag(tag: unknown): tag is SupportedTag {
  return typeof tag === 'string' && SUPPORTED_TAG_SET.has(tag);
}

/**
 * The two maps divide the work, and the division is not arbitrary — it comes
 * from which hooks actually co-occur in the data:
 *
 *   part-of-speech-info + tag, forms-label + tag, misc-info + tag, field-info +
 *   tag, dialect-info + tag, xref + extra-box, example-sentence + extra-box,
 *   sense-note + extra-box, …
 *
 * So **`data-sc-class` owns the shape** (the badge, the box) and
 * **`data-sc-content` owns only colour and typography**. Give both a badge
 * recipe and a node carrying both ends up with `badge-sm badge-xs` and two
 * competing colours.
 *
 * These are a floor, not the final word: when the dictionary ships its own
 * `styles.css` it selects on the same attributes and layers on top. Without that
 * stylesheet the entry still has to be readable and still has to follow the
 * theme — hence daisyUI semantic tokens and no raw palette.
 *
 * An empty value means "supported, needs no styling of its own"; a hook that is
 * absent from the map is reported to diagnostics instead.
 *
 * Written out in full rather than assembled, because Tailwind scans source text
 * and never generates an interpolated class.
 */
export const HOOK_CLASSES: Readonly<Record<string, string>> = {
  // Structure.
  'sense-groups': 'space-y-2',
  'sense-group': 'space-y-1',
  sense: '',
  glossary: 'space-y-0.5',
  'extra-info': 'mt-1',
  forms: 'text-sm text-base-content/70 mt-2',
  attribution: 'text-xs text-base-content/50 mt-2',
  'attribution-footnote': 'text-xs text-base-content/40 align-super',
  'redirect-glossary': 'text-base-content/70 italic',

  // Colour only — these always arrive with `data-sc-class="tag"`, which is what
  // makes them a badge.
  'part-of-speech-info': 'text-info',
  'misc-info': 'text-warning',
  'field-info': 'text-accent',
  'forms-label': 'text-base-content/60',

  // Typography only — these always arrive with `data-sc-class="extra-box"`,
  // which is what gives them their box.
  xref: 'text-sm',
  'xref-content': 'inline',
  'xref-glossary': 'text-base-content/60 ml-1',
  'reference-label': 'text-xs font-medium text-base-content/60 mr-1',
  'example-sentence': 'text-sm',
  'example-sentence-a': '',
  'example-sentence-b': 'text-base-content/60',
  'example-keyword': 'font-bold text-primary',
};

/** The shapes. `data-sc-class` is the only thing that draws a box or a badge. */
export const CLASS_CLASSES: Readonly<Record<string, string>> = {
  tag: 'badge badge-xs badge-ghost align-middle mr-1',
  'extra-box': 'surface-muted rounded-box px-2 py-1 mt-1',
  'form-valid': 'text-success',
};

/**
 * `data-sc-*` values are echoed into the DOM for the dictionary's CSS to select
 * on, so they are held to a shape that cannot do anything but match a selector.
 */
const SAFE_TOKEN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
export function isSafeToken(value: unknown): value is string {
  return typeof value === 'string' && SAFE_TOKEN.test(value);
}

/** BCP-47-ish. Wrong-but-harmless is fine; unbounded junk in an attribute is not. */
const LANGUAGE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
export function isSafeLanguage(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 35 && LANGUAGE.test(value);
}

/**
 * The only inline style property in the whole of Jitendex: `listStyleType`, used
 * for the circled sense numbers ①②③. Either a quoted string or a CSS keyword;
 * anything carrying a delimiter, a `url(` or a comment is refused outright.
 */
const LIST_STYLE_KEYWORD = /^[a-z-]{1,32}$/;
export function safeListStyleType(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 32) return undefined;
  if (/[;{}()\\<>]/.test(value) || value.includes('/*')) return undefined;

  const quoted = value.match(/^"([^"\\]*)"$/) ?? value.match(/^'([^'\\]*)'$/);
  if (quoted) return `"${quoted[1]}"`;
  return LIST_STYLE_KEYWORD.test(value) ? value : undefined;
}

/** `title` becomes a tooltip; React escapes it, but it should still be bounded. */
export function safeTitle(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return undefined;
  return trimmed;
}
