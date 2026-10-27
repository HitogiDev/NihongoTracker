import DOMPurify from 'dompurify';
import { marked, type Tokens } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

const SPOILER_REGEX = /\|\|([\s\S]+?)\|\|/g;

export const MENTIONABLE_MEDIA_TYPES = [
  'anime',
  'manga',
  'light-novel',
  'vn',
  'game',
  'video',
  'movie',
  'tv show',
  'book',
] as const;

export type MentionableMediaType = (typeof MENTIONABLE_MEDIA_TYPES)[number];

/** `common` namespace keys for the media type badge. */
export const MENTION_MEDIA_TYPE_LABEL_KEYS = {
  anime: 'mediaTypes.anime',
  manga: 'mediaTypes.manga',
  'light-novel': 'mediaTypes.light-novel',
  vn: 'mediaTypes.vn',
  game: 'mediaTypes.game',
  video: 'mediaTypes.video',
  movie: 'mediaTypes.movie',
  'tv show': 'mediaTypes.tvShow',
  book: 'mediaTypes.book',
} as const satisfies Record<MentionableMediaType, string>;

/** Usernames follow the registration charset in `utils/validation.ts`. */
const USER_MENTION_REGEX = /^@([A-Za-z0-9_-]{1,20})(?![A-Za-z0-9_-])/;
/** Skip an @ that follows an email local part so that GFM can autolink the email. */
const USER_MENTION_START = /(^|[^A-Za-z0-9_.+-])@[A-Za-z0-9_-]/;
const MEDIA_MENTION_REGEX = new RegExp(
  `^\\[\\[(${MENTIONABLE_MEDIA_TYPES.join('|')}):([^\\]|\\s]+)(?:\\|([^\\]\\n]{0,200}))?\\]\\]`
);
const WORD_CHARACTER_AT_END = /[A-Za-z0-9_@.]$/;

interface UserMentionToken extends Tokens.Generic {
  type: 'userMention';
  raw: string;
  username: string;
}

interface MediaMentionToken extends Tokens.Generic {
  type: 'mediaMention';
  raw: string;
  mediaType: MentionableMediaType;
  contentId: string;
  label: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

marked.use({
  extensions: [
    {
      name: 'userMention',
      level: 'inline',
      start(src) {
        const match = USER_MENTION_START.exec(src);
        return match ? match.index + match[1].length : undefined;
      },
      tokenizer(src, tokens): UserMentionToken | undefined {
        const match = USER_MENTION_REGEX.exec(src);
        if (!match) return undefined;
        // Reject "name@host" so that email-like text stays plain text.
        const previous = tokens[tokens.length - 1];
        if (
          previous?.type === 'text' &&
          WORD_CHARACTER_AT_END.test(previous.raw)
        ) {
          return undefined;
        }
        return { type: 'userMention', raw: match[0], username: match[1] };
      },
      renderer(token) {
        const username = escapeHtml((token as UserMentionToken).username);
        const href = `/user/${encodeURIComponent((token as UserMentionToken).username)}`;
        return `<span data-mention="user" data-username="${username}"><a href="${href}">@${username}</a></span>`;
      },
    },
    {
      name: 'mediaMention',
      level: 'inline',
      start(src) {
        const index = src.indexOf('[[');
        return index === -1 ? undefined : index;
      },
      tokenizer(src): MediaMentionToken | undefined {
        const match = MEDIA_MENTION_REGEX.exec(src);
        if (!match) return undefined;
        return {
          type: 'mediaMention',
          raw: match[0],
          mediaType: match[1] as MentionableMediaType,
          contentId: match[2],
          label: match[3]?.trim() ?? '',
        };
      },
      renderer(token) {
        const { mediaType, contentId, label } = token as MediaMentionToken;
        const href = `/${encodeURIComponent(mediaType)}/${encodeURIComponent(contentId)}`;
        const text = escapeHtml(label || contentId);
        return `<span data-mention="media" data-media-type="${escapeHtml(mediaType)}" data-media-id="${escapeHtml(contentId)}" data-label="${text}"><a href="${href}">${text}</a></span>`;
      },
    },
  ],
});

/** Markdown token that cites a user. */
export function buildUserMention(username: string): string {
  return `@${username}`;
}

/** Markdown token that cites a work. The label keeps the raw text readable. */
export function buildMediaMention(
  mediaType: MentionableMediaType,
  contentId: string,
  title: string
): string {
  const label = title.replace(/[\]|\n\r]+/g, ' ').trim().slice(0, 200);
  return `[[${mediaType}:${contentId}${label ? `|${label}` : ''}]]`;
}

export function isMentionableMediaType(
  value: string | undefined
): value is MentionableMediaType {
  return MENTIONABLE_MEDIA_TYPES.includes(value as MentionableMediaType);
}

export function renderMarkdownWithSpoilers(markdownText: string): string {
  if (!markdownText || !markdownText.trim()) {
    return '';
  }

  const withSpoilers = markdownText.replace(
    SPOILER_REGEX,
    '<span class="spoiler">$1</span>'
  );

  const rawHtml = marked.parse(withSpoilers, { async: false }) as string;

  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_ATTR: [
      'class',
      'href',
      'src',
      'alt',
      'title',
      'target',
      'rel',
      'data-mention',
      'data-username',
      'data-media-type',
      'data-media-id',
      'data-label',
    ],
  });
}
