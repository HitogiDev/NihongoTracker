import { useEffect, useState } from 'react';

function getCssVariable(name: string) {
  if (typeof document === 'undefined') {
    return null;
  }

  const rootValue = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  if (rootValue) {
    return rootValue;
  }

  const scopedThemeEl = document.querySelector('[data-theme]');
  if (scopedThemeEl instanceof HTMLElement) {
    const scopedValue = getComputedStyle(scopedThemeEl)
      .getPropertyValue(name)
      .trim();

    if (scopedValue) {
      return scopedValue;
    }
  }

  return null;
}

/**
 * Convierte un color CSS (hsl, rgb, hex, oklch) en rgba con opacidad
 */
function toRGBA(color: string, alpha = 1): string {
  const normalizedColor = color.trim();
  if (!normalizedColor) return `rgba(0,0,0,${alpha})`;

  if (normalizedColor.startsWith('hsla(')) {
    return normalizedColor.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
  }

  if (normalizedColor.startsWith('hsl(')) {
    return normalizedColor
      .replace(/^hsl\(/, 'hsla(')
      .replace(')', `, ${alpha})`);
  }

  if (normalizedColor.startsWith('oklch(')) {
    if (normalizedColor.includes('/')) {
      return normalizedColor.replace(/\/\s*[\d.]+\)$/, `/ ${alpha})`);
    }

    return normalizedColor.replace(')', ` / ${alpha})`);
  }

  if (normalizedColor.startsWith('#')) {
    const hex = normalizedColor.slice(1);

    const expandedHex =
      hex.length === 3 || hex.length === 4
        ? hex
            .split('')
            .map((char) => char + char)
            .join('')
        : hex;

    if (expandedHex.length !== 6 && expandedHex.length !== 8) {
      return `rgba(0,0,0,${alpha})`;
    }

    const r = parseInt(expandedHex.slice(0, 2), 16);
    const g = parseInt(expandedHex.slice(2, 4), 16);
    const b = parseInt(expandedHex.slice(4, 6), 16);

    if ([r, g, b].some((value) => Number.isNaN(value))) {
      return `rgba(0,0,0,${alpha})`;
    }

    const embeddedAlpha =
      expandedHex.length === 8
        ? parseInt(expandedHex.slice(6, 8), 16) / 255
        : 1;

    const finalAlpha = Math.max(
      0,
      Math.min(1, Number((embeddedAlpha * alpha).toFixed(3)))
    );

    return `rgba(${r}, ${g}, ${b}, ${finalAlpha})`;
  }

  if (normalizedColor.startsWith('rgba(')) {
    return normalizedColor.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
  }

  if (normalizedColor.startsWith('rgb(')) {
    return normalizedColor
      .replace(/^rgb\(/, 'rgba(')
      .replace(')', `, ${alpha})`);
  }

  return normalizedColor;
}

/**
 * Fallbacks are only used before the first paint or outside a browser; the
 * real values come from the active daisyUI theme.
 */
const FALLBACKS = {
  baseContent: '#000000',
  base100: '#ffffff',
  base200: '#f9f9f9',
  base300: '#e0e0e0',
  primary: '#3b82f6',
  secondary: '#f59e0b',
  accent: '#10b981',
  info: '#0ea5e9',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
} as const;

const CSS_VARIABLES: Record<keyof typeof FALLBACKS, string> = {
  baseContent: '--color-base-content',
  base100: '--color-base-100',
  base200: '--color-base-200',
  base300: '--color-base-300',
  primary: '--color-primary',
  secondary: '--color-secondary',
  accent: '--color-accent',
  info: '--color-info',
  success: '--color-success',
  warning: '--color-warning',
  error: '--color-error',
};

export type ThemeColors = Record<keyof typeof FALLBACKS, string>;

export function useThemeColors(alpha = 1) {
  const [colors, setColors] = useState<ThemeColors>({ ...FALLBACKS });

  useEffect(() => {
    const updateColors = () => {
      const next = {} as ThemeColors;
      (Object.keys(CSS_VARIABLES) as Array<keyof typeof FALLBACKS>).forEach(
        (key) => {
          next[key] = toRGBA(
            getCssVariable(CSS_VARIABLES[key]) || FALLBACKS[key],
            alpha
          );
        }
      );
      setColors(next);
    };

    updateColors();

    // Recalcular si cambia el tema
    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, [alpha]);

  return colors;
}
