import { apiError } from '../i18n/errorCodes.js';
import {
  IPostDecoration,
  POST_BACKGROUND_PATTERNS,
  POST_BACKGROUND_TYPES,
  POST_BORDER_STYLES,
  PostBackgroundPattern,
  PostBackgroundType,
  PostBorderStyle,
} from '../types.js';
import { validatePostImageUrl } from './remoteImage.js';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const POST_DECORATION_DEFAULTS = {
  borderColor1: '#a855f7',
  borderColor2: '#ec4899',
  backgroundColor: '#1e293b',
  patternColor: '#a855f7',
  opacity: 100,
} as const;

/** Decoration as the client sends it. The background image is resolved later. */
export interface PostDecorationInput {
  border: IPostDecoration['border'];
  background: Omit<IPostDecoration['background'], 'image'> & {
    /** A validated external link for a new background image. */
    imageUrl: string | null;
    /** Keep the current background image when no new image is given. */
    keepImage: boolean;
  };
}

function invalid(): never {
  throw apiError('post.invalidDecoration', 400, 'Invalid post decoration');
}

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string' || !allowed.includes(value as T)) invalid();
  return value as T;
}

function readColor(value: unknown, fallback: string): string {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) invalid();
  return value.toLowerCase();
}

function readOpacity(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return POST_DECORATION_DEFAULTS.opacity;
  }
  const number = typeof value === 'string' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) invalid();
  return Math.min(100, Math.max(0, Math.round(number)));
}

function readImageUrl(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') invalid();
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw apiError('post.invalidImageUrl', 400, 'Invalid image URL');
  }
  try {
    return validatePostImageUrl(parsed.href).href;
  } catch {
    throw apiError(
      'post.unsupportedImageHost',
      400,
      'Images from this site are not supported',
      { host: parsed.hostname }
    );
  }
}

/**
 * Read the `decoration` field from a JSON string (multipart) or an object.
 * Return null when the post has no border and no background.
 */
export function parsePostDecorationInput(
  value: unknown
): PostDecorationInput | null {
  if (value === undefined || value === null || value === '') return null;
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      invalid();
    }
  }
  if (parsed === null) return null;
  const root = readObject(parsed);
  const border = root.border === undefined ? {} : readObject(root.border);
  const background =
    root.background === undefined ? {} : readObject(root.background);

  const input: PostDecorationInput = {
    border: {
      style: readEnum<PostBorderStyle>(border.style, POST_BORDER_STYLES, 'none'),
      color1: readColor(border.color1, POST_DECORATION_DEFAULTS.borderColor1),
      color2: readColor(border.color2, POST_DECORATION_DEFAULTS.borderColor2),
    },
    background: {
      type: readEnum<PostBackgroundType>(
        background.type,
        POST_BACKGROUND_TYPES,
        'none'
      ),
      color: readColor(
        background.color,
        POST_DECORATION_DEFAULTS.backgroundColor
      ),
      pattern: readEnum<PostBackgroundPattern>(
        background.pattern,
        POST_BACKGROUND_PATTERNS,
        'dots'
      ),
      patternColor: readColor(
        background.patternColor,
        POST_DECORATION_DEFAULTS.patternColor
      ),
      opacity: readOpacity(background.opacity),
      imageUrl: readImageUrl(background.imageUrl),
      keepImage: background.keepImage === true,
    },
  };
  if (input.border.style === 'none' && input.background.type === 'none') {
    return null;
  }
  return input;
}

/** Compare decorations by appearance. Upload dates do not count as a change. */
export function decorationSignature(
  decoration:
    | (Omit<IPostDecoration, 'background'> & {
        background: Omit<IPostDecoration['background'], 'image'> & {
          imageKey: string | null;
        };
      })
    | null
): string {
  if (!decoration) return 'none';
  const { border, background } = decoration;
  return JSON.stringify([
    border.style,
    border.style === 'none' ? '' : border.color1,
    border.style === 'gradient' ? border.color2 : '',
    background.type,
    background.type === 'color' ? background.color : '',
    background.type === 'pattern' ? background.pattern : '',
    background.type === 'pattern' ? background.patternColor : '',
    background.type === 'none' ? 0 : background.opacity,
    background.type === 'image' ? background.imageKey : '',
  ]);
}

export function storedDecorationSignature(
  decoration: IPostDecoration | null | undefined
): string {
  if (!decoration) return 'none';
  return decorationSignature({
    border: decoration.border,
    background: {
      ...decoration.background,
      imageKey: decoration.background.image?.url ?? null,
    },
  });
}
