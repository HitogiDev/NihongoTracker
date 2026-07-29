import { ProfileWidgetId, ProfileWidgetLayout } from '../types';

interface ProfileWidgetMeta {
  id: ProfileWidgetId;
  label: string;
  description: string;
  /** Only shown on the owner's own profile (never rendered for other visitors). */
  ownerOnly?: boolean;
}

// Order here is the canonical default order of the left column on the profile.
export const PROFILE_WIDGETS: ProfileWidgetMeta[] = [
  {
    id: 'profileStats',
    label: 'Profile Stats',
    description: 'Rankings, totals and ranking-over-time graph.',
  },
  {
    id: 'about',
    label: 'About',
    description: 'Your bio / introduction.',
  },
  {
    id: 'favorites',
    label: 'Favorite Media',
    description: 'Showcase of your favorite media.',
  },
  {
    id: 'progressStats',
    label: 'Progress Stats',
    description: 'Overall, listening and reading levels.',
  },
  {
    id: 'immersionActivity',
    label: 'Immersion Activity',
    description: 'Heatmap of your immersion over time.',
  },
  {
    id: 'immersionGoals',
    label: 'Immersion Goals',
    description: 'Your active goals (only visible to you).',
    ownerOnly: true,
  },
  {
    id: 'achievements',
    label: 'Achievement Showcase',
    description: 'Your top earned achievements.',
  },
];

export const PROFILE_WIDGET_META: Record<ProfileWidgetId, ProfileWidgetMeta> =
  PROFILE_WIDGETS.reduce(
    (acc, w) => {
      acc[w.id] = w;
      return acc;
    },
    {} as Record<ProfileWidgetId, ProfileWidgetMeta>
  );

export const DEFAULT_PROFILE_LAYOUT: ProfileWidgetLayout[] =
  PROFILE_WIDGETS.map((w) => ({ id: w.id, visible: true }));

/**
 * Merge a saved layout with the canonical widget list:
 *  - drops unknown/removed widget ids,
 *  - appends any newly-added widgets (not yet in the saved layout) at the end,
 *    visible by default,
 * so old saved layouts keep working as widgets are added or removed.
 */
export function resolveProfileLayout(
  saved?: ProfileWidgetLayout[] | null
): ProfileWidgetLayout[] {
  if (!saved || saved.length === 0) return DEFAULT_PROFILE_LAYOUT;

  const known = new Set(PROFILE_WIDGETS.map((w) => w.id));
  const seen = new Set<ProfileWidgetId>();
  const merged: ProfileWidgetLayout[] = [];

  for (const item of saved) {
    if (!item || !known.has(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push({ id: item.id, visible: item.visible !== false });
  }

  for (const w of PROFILE_WIDGETS) {
    if (!seen.has(w.id)) merged.push({ id: w.id, visible: true });
  }

  return merged;
}
