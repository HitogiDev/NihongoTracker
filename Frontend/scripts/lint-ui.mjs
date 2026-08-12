#!/usr/bin/env node
/**
 * UI convention checks that ESLint selectors cannot express, because they are
 * about the *text* of a class string rather than the shape of the AST.
 *
 * Run with `npm run lint:ui`. See CLAUDE.md > UI Conventions (Frontend).
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { relative } from 'node:path';

const ROOT = 'E:/Coding/NihongoTracker/';

/** Files where a raw Tailwind palette colour is the correct answer. */
const PALETTE_ALLOWLIST = [
  // Gold / silver / bronze medals must not follow the theme.
  'Frontend/src/screens/AdminScreen.tsx',
  // Per-media-type identity colours, defined once and shared.
  'Frontend/src/constants/mediaColors.ts',
  'Frontend/src/components/LogCard.tsx',
  'Frontend/src/components/PlaylistBatchCard.tsx',
  'Frontend/src/screens/ListScreen.tsx',
];

const RULES = [
  {
    id: 'icon-size-prop',
    // lucide icons size via className so one scale governs every icon.
    // `AchievementIcon` is our own component whose only sizing API is `size`.
    re: /<(?!AchievementIcon\b)[A-Z][\w.]*[^>]*\ssize=\{\d+\}/g,
    message:
      'Size lucide icons with className (w-4 h-4 inline, w-5 h-5 standalone, w-6 h-6 section header), not the numeric `size` prop.',
  },
  {
    id: 'header-offset',
    re: /className="[^"]*min-h-screen[^"]*\bpt-(16|24|32)\b/g,
    message:
      'The overlaying navbar is 80px tall. Use `pt-20` (HEADER_OFFSET) when a child container supplies the page gap, or `pt-28` (HEADER_OFFSET_CONTENT) when content sits directly under it. Not pt-16/24/32.',
  },
  {
    id: 'double-dim-backdrop',
    re: /modal-backdrop[^"`]*bg-black\//g,
    message:
      '`.modal` already dims the page to 0.4; a tint on modal-backdrop stacks a second layer.',
  },
  {
    id: 'interpolated-class',
    re: /(?:className|Class)\s*=?\s*[{"`][^"`]*\b(?:btn|badge|loading|alert|input|text|bg|border)-\$\{/g,
    message:
      'Tailwind v4 scans source text — a class assembled at runtime is never generated. Use a map of complete literal class names.',
  },
  {
    id: 'raw-palette',
    re: /className="[^"]*\b(?:bg|text|border|fill|ring)-(?:red|blue|green|amber|purple|slate|gray|zinc|yellow|orange|emerald|indigo|pink|teal|cyan)-\d00\b/g,
    message:
      'Use a daisyUI semantic token (primary/success/warning/error/base-*) so the colour follows the theme.',
    allowlist: PALETTE_ALLOWLIST,
  },
];

const files = execSync(
  `git -C ${ROOT} ls-files "Frontend/src/**/*.tsx" "Frontend/src/**/*.ts"`,
  { encoding: 'utf8' }
)
  .trim()
  .split('\n');

let failures = 0;

for (const rel of files) {
  const src = readFileSync(ROOT + rel, 'utf8');
  const lines = src.split('\n');

  for (const rule of RULES) {
    if (rule.allowlist?.includes(rel)) continue;
    rule.re.lastIndex = 0;
    for (const match of src.matchAll(rule.re)) {
      const line = src.slice(0, match.index).split('\n').length;
      failures++;
      console.log(
        `${relative(process.cwd(), ROOT + rel)}:${line}  ${rule.id}\n    ${lines[
          line - 1
        ]
          .trim()
          .slice(0, 140)}\n    ${rule.message}\n`
      );
    }
  }
}

if (failures) {
  console.log(`lint:ui — ${failures} problem(s)`);
  process.exit(1);
}
console.log('lint:ui — clean');
