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

export function useThemeColors(alpha = 1) {
  const [colors, setColors] = useState({
    baseContent: '#000000',
    base100: '#ffffff',
    base200: '#f9f9f9',
    base300: '#e0e0e0',
    primary: '#3b82f6',
    secondary: '#f59e0b',
  });

  useEffect(() => {
    const updateColors = () => {
      setColors({
        baseContent: toRGBA(
          getCssVariable('--color-base-content') || '#000000',
          alpha
        ),
        base100: toRGBA(getCssVariable('--color-base-100') || '#ffffff', alpha),
        base200: toRGBA(getCssVariable('--color-base-200') || '#f9f9f9', alpha),
        base300: toRGBA(getCssVariable('--color-base-300') || '#e0e0e0', alpha),
        primary: toRGBA(getCssVariable('--color-primary') || '#3b82f6', alpha),
        secondary: toRGBA(
          getCssVariable('--color-secondary') || '#f59e0b',
          alpha
        ),
      });
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
