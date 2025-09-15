import { useEffect, useState } from 'react';

function getCssVariable(name: string) {
  const themeEl = document.documentElement.hasAttribute('data-theme')
    ? document.documentElement
    : document.body.hasAttribute('data-theme')
      ? document.body
      : document.querySelector('[data-theme]');

  if (!themeEl) return null;
  return getComputedStyle(themeEl).getPropertyValue(name).trim() || null;
}

/**
 * Convierte un color CSS (hsl, rgb, hex, oklch) en rgba con opacidad
 */
function toRGBA(color: string, alpha = 1): string {
  if (!color) return `rgba(0,0,0,${alpha})`;

  // Si ya es hsl u oklch, Chart.js lo acepta con barra de opacidad
  if (color.startsWith('hsl')) {
    return color.replace('hsl', 'hsla').replace(')', `, ${alpha})`);
  }

  if (color.startsWith('oklch')) {
    return color.replace('oklch', 'oklch').replace(')', ` / ${alpha})`);
  }

  // Si es hex (#rrggbb)
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Si ya es rgb
  if (color.startsWith('rgb')) {
    return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
  }

  return color;
}

export function useThemeColors(alpha = 1) {
  const [colors, setColors] = useState({
    baseContent: '#000',
    primary: '#3b82f6',
    secondary: '#f59e0b',
  });

  useEffect(() => {
    const updateColors = () => {
      setColors({
        baseContent: toRGBA(
          getCssVariable('--color-base-content') || '#000',
          alpha
        ),
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
