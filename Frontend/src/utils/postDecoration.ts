import type { CSSProperties } from 'react';
import { externalPostImageSrc, postImageSrc } from '../api/postsApi';
import type {
  IPostDecoration,
  PostBackgroundPattern,
  PostBackgroundType,
  PostBorderStyle,
} from '../types';

/** Keep aligned with `POST_DECORATION_DEFAULTS` in `Backend/src/services/postDecoration.ts`. */
export const DEFAULT_POST_DECORATION: IPostDecoration = {
  border: { style: 'none', color1: '#a855f7', color2: '#ec4899' },
  background: {
    type: 'none',
    color: '#1e293b',
    pattern: 'dots',
    patternColor: '#a855f7',
    opacity: 100,
    image: null,
  },
};

export const POST_BORDER_STYLES: PostBorderStyle[] = [
  'none',
  'solid',
  'dashed',
  'dotted',
  'double',
  'gradient',
  'glow',
];

export const POST_BACKGROUND_TYPES: PostBackgroundType[] = [
  'none',
  'color',
  'pattern',
  'image',
];

export const POST_BACKGROUND_PATTERNS: PostBackgroundPattern[] = [
  'dots',
  'grid',
  'stripes',
  'checks',
  'zigzag',
  'seigaiha',
];

export function hasPostDecoration(
  decoration: IPostDecoration | null | undefined,
): decoration is IPostDecoration {
  return Boolean(
    decoration &&
      (decoration.border.style !== 'none' ||
        decoration.background.type !== 'none'),
  );
}

/** Pattern layers drawn with CSS gradients, so they stay sharp at any zoom. */
export function patternStyle(
  pattern: PostBackgroundPattern,
  color: string,
): CSSProperties {
  switch (pattern) {
    case 'dots':
      return {
        backgroundImage: `radial-gradient(${color} 1.5px, transparent 1.6px)`,
        backgroundSize: '16px 16px',
      };
    case 'grid':
      return {
        backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
      };
    case 'stripes':
      return {
        backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 6px, transparent 6px 18px)`,
      };
    case 'checks':
      return {
        backgroundImage: `conic-gradient(${color} 25%, transparent 0 50%, ${color} 0 75%, transparent 0)`,
        backgroundSize: '24px 24px',
      };
    case 'zigzag':
      return {
        backgroundImage: `linear-gradient(135deg, ${color} 25%, transparent 25%), linear-gradient(225deg, ${color} 25%, transparent 25%), linear-gradient(45deg, ${color} 25%, transparent 25%), linear-gradient(315deg, ${color} 25%, transparent 25%)`,
        backgroundPosition: '10px 0, 10px 0, 0 0, 0 0',
        backgroundSize: '20px 20px',
      };
    case 'seigaiha':
      return {
        backgroundImage: `radial-gradient(circle at 100% 150%, transparent 24%, ${color} 24% 30%, transparent 30% 36%, ${color} 36% 42%, transparent 42% 48%, ${color} 48% 54%, transparent 54%), radial-gradient(circle at 0 150%, transparent 24%, ${color} 24% 30%, transparent 30% 36%, ${color} 36% 42%, transparent 42% 48%, ${color} 48% 54%, transparent 54%), radial-gradient(circle at 50% 100%, transparent 24%, ${color} 24% 30%, transparent 30% 36%, ${color} 36% 42%, transparent 42% 48%, ${color} 48% 54%, transparent 54%)`,
        backgroundSize: '40px 20px',
      };
  }
}

/** Style of the layer behind the post content. */
export function backgroundLayerStyle(
  background: IPostDecoration['background'],
  imageSrc?: string,
): CSSProperties | null {
  const opacity = Math.min(100, Math.max(0, background.opacity)) / 100;
  switch (background.type) {
    case 'color':
      return { backgroundColor: background.color, opacity };
    case 'pattern':
      return { ...patternStyle(background.pattern, background.patternColor), opacity };
    case 'image': {
      const src =
        imageSrc ?? (background.image ? postImageSrc(background.image) : '');
      if (!src) return null;
      return {
        backgroundImage: `url("${src.replace(/"/g, '%22')}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity,
      };
    }
    default:
      return null;
  }
}

/**
 * Style of the frame around the post.
 * A gradient border is a padded wrapper with a gradient background.
 */
export function borderFrameStyle(
  border: IPostDecoration['border'],
): CSSProperties | null {
  switch (border.style) {
    case 'solid':
    case 'dashed':
    case 'dotted':
      return { border: `2px ${border.style} ${border.color1}` };
    case 'double':
      return { border: `4px double ${border.color1}` };
    case 'gradient':
      return {
        padding: '2px',
        backgroundImage: `linear-gradient(135deg, ${border.color1}, ${border.color2})`,
      };
    case 'glow':
      return {
        border: `1px solid ${border.color1}`,
        boxShadow: `0 0 12px ${border.color1}99, 0 0 2px ${border.color1}`,
      };
    default:
      return null;
  }
}

/** Where the background image comes from. */
export type BackgroundImageChoice =
  | { kind: 'none' }
  | { kind: 'current'; image: NonNullable<IPostDecoration['background']['image']> }
  | { kind: 'link'; url: string }
  | { kind: 'file'; file: File; previewUrl: string };

export function backgroundChoicePreview(choice: BackgroundImageChoice): string {
  switch (choice.kind) {
    case 'current':
      return postImageSrc(choice.image);
    case 'link':
      return externalPostImageSrc(choice.url);
    case 'file':
      return choice.previewUrl;
    default:
      return '';
  }
}
