/**
 * Canonical daisyUI button recipes, one per UI role, plus the class builder
 * shared with the `<Button>` component.
 *
 * Prefer `<Button>`. The raw strings here exist for the cases a component
 * cannot cover: `<a>` / router `Link` / `<label>` / `<summary>` styled as a
 * button, and `join-item` members whose state is computed.
 *
 * Class order is always: btn -> color -> style -> behavior -> size -> shape.
 * Never build a class by interpolation (`btn-${color}`) — Tailwind v4 only
 * generates utilities it can see as literal strings in the source.
 */
export const BTN = {
  /** Main action of a page or form. */
  primary: 'btn btn-primary',
  /** Primary action inside a narrow card (auth screens, settings panels). */
  primaryBlock: 'btn btn-primary w-full',
  /** The commit action of a full-page form (log, sign-up, share). */
  submitBlock: 'btn btn-primary btn-lg w-full',
  /** Destructive confirm. */
  danger: 'btn btn-error',
  /** Cancel / secondary. Always the same size as the primary it sits next to. */
  secondary: 'btn btn-ghost',

  /** Toolbar / inline action with a text label. */
  action: 'btn btn-sm',
  actionPrimary: 'btn btn-primary btn-sm',
  actionOutline: 'btn btn-outline btn-sm',
  actionDanger: 'btn btn-error btn-sm',

  /* Icon-only buttons come in two shapes.
     `btn-square` for actions that sit in a toolbar or a list row, `btn-circle`
     for the round affordances users already read as round: a modal's close X,
     a chip's remove X, carousel arrows. */

  /** Icon-only action in a card header or list row. */
  icon: 'btn btn-ghost btn-sm btn-square',
  /** Icon-only action in a dense table row. */
  iconDense: 'btn btn-ghost btn-xs btn-square',
  /** Icon-only action at page-header scale (back arrow next to an h1). */
  iconLarge: 'btn btn-ghost btn-square',

  /** Modal close X. */
  close: 'btn btn-ghost btn-sm btn-circle',
  /** Remove X on a chip/badge, or the clear X inside an input. */
  clear: 'btn btn-ghost btn-xs btn-circle',
  /** Carousel / pager arrow. */
  navArrow: 'btn btn-outline btn-sm btn-circle',

  /** Marketing hero call to action. Ghost, not outline: these sit on a
   *  gradient where an outline reads as a disabled input. */
  cta: 'btn btn-primary btn-lg px-8',
  ctaSecondary: 'btn btn-ghost btn-lg px-8',

  /** Pagination member. Parent needs `join`. */
  joinItem: 'join-item btn btn-sm',
  joinItemActive: 'join-item btn btn-active btn-sm',
  /** Segmented control (view mode, category). Parent needs `join`. */
  segment: 'join-item btn btn-outline btn-sm',
  segmentActive: 'join-item btn btn-primary btn-sm',
} as const;

/* ── Class builder ─────────────────────────────────────────────────────────
   Maps hold complete literal class names on purpose — Tailwind v4 scans source
   text, so an interpolated `btn-${variant}` would never be generated. */

const VARIANT = {
  default: '',
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  accent: 'btn-accent',
  neutral: 'btn-neutral',
  info: 'btn-info',
  success: 'btn-success',
  warning: 'btn-warning',
  error: 'btn-error',
} as const;

const APPEARANCE = {
  solid: '',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  soft: 'btn-soft',
  link: 'btn-link',
} as const;

const SIZE = {
  xs: 'btn-xs',
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
} as const;

const SHAPE = {
  none: '',
  square: 'btn-square',
  circle: 'btn-circle',
} as const;

export type ButtonVariant = keyof typeof VARIANT;
export type ButtonAppearance = keyof typeof APPEARANCE;
export type ButtonSize = keyof typeof SIZE;
export type ButtonShape = keyof typeof SHAPE;

export interface ButtonStyleProps {
  variant?: ButtonVariant;
  appearance?: ButtonAppearance;
  size?: ButtonSize;
  shape?: ButtonShape;
  /** Full-width button (daisyUI `btn-block`). */
  block?: boolean;
  className?: string;
}

/**
 * Class string for elements that must not be a `<button>` — router `Link`,
 * `<a>`, `<label htmlFor>`, `<summary>`. Prefer `<Button>` everywhere else.
 */
export function buttonClass({
  variant = 'default',
  appearance = 'solid',
  size = 'md',
  shape = 'none',
  block = false,
  className = '',
}: ButtonStyleProps = {}): string {
  return [
    'btn',
    VARIANT[variant],
    APPEARANCE[appearance],
    SIZE[size],
    SHAPE[shape],
    block ? 'btn-block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Spinner size that fits inside each button size without overflowing it. */
export const BTN_SPINNER: Record<ButtonSize, 'xs' | 'sm' | 'md'> = {
  xs: 'xs',
  sm: 'xs',
  md: 'sm',
  lg: 'md',
};
