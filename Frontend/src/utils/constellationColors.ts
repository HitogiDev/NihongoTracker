import constellations from '../assets/avatar-frames/constellations.svg?raw';

export const DEFAULT_CONSTELLATION_COLOR = '#f4f8ff';

export function getConstellationColor(color?: string): string | undefined {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : undefined;
}

export function getConstellationBackground(color: string): string {
  const svg = constellations
    .split(DEFAULT_CONSTELLATION_COLOR)
    .join(color)
    .split('#b6d9ff')
    .join(color);
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
