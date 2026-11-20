import type { ParseKeys } from 'i18next';
import { ProfileWidgetId, ProfileWidgetLayout } from '../types';

interface ProfileWidgetMeta {
  id: ProfileWidgetId;
  /** Translation keys: this module is pure, callers render them with `t`. */
  labelKey: ParseKeys<'settings'>;
  /** Set only when the label does not explain what the widget shows. */
  descriptionKey?: ParseKeys<'settings'>;
  /** Only shown on the owner's own profile (never rendered for other visitors). */
  ownerOnly?: boolean;
}

// Order here is the canonical default order of the left column on the profile.
export const PROFILE_WIDGETS: ProfileWidgetMeta[] = [
  {
    id: 'profileStats',
    labelKey: 'profileWidgets.profileStats.label',
  },
  {
    id: 'about',
    labelKey: 'profileWidgets.about.label',
  },
  {
    id: 'favorites',
    labelKey: 'profileWidgets.favorites.label',
  },
  {
    id: 'currentMedia',
    labelKey: 'profileWidgets.currentMedia.label',
    descriptionKey: 'profileWidgets.currentMedia.description',
  },
  {
    id: 'progressStats',
    labelKey: 'profileWidgets.progressStats.label',
  },
  {
    id: 'immersionActivity',
    labelKey: 'profileWidgets.immersionActivity.label',
  },
  {
    id: 'immersionGoals',
    labelKey: 'profileWidgets.immersionGoals.label',
    ownerOnly: true,
  },
  {
    id: 'duels',
    labelKey: 'profileWidgets.duels.label',
    ownerOnly: true,
  },
  {
    id: 'achievements',
    labelKey: 'profileWidgets.achievements.label',
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
