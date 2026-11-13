import { registerPlugin } from '@capacitor/core';

/**
 * Account summary for the Android home screen widgets.
 * Keep the fields aligned with Mobile/android/.../widgets/WidgetSnapshot.java.
 */
export interface WidgetSnapshot {
  timezone: string;
  dayStartHour: number;
  weekStartsOn: number;
  /** The user's current day (YYYY-MM-DD) when the app wrote the summary. */
  dayKey: string;
  /** The first day of the user's current week (YYYY-MM-DD). */
  weekKey: string;
  streak: number;
  /** The last day (YYYY-MM-DD) that counts toward the streak. */
  lastStreakDay: string;
  level: number;
  /** Progress through the current level, from 0 to 1. */
  levelProgress: number;
  goals: {
    label: string;
    type: 'time' | 'chars' | 'episodes' | 'pages';
    cadence: 'daily' | 'weekly';
    progress: number;
    target: number;
  }[];
  labels: Record<string, string>;
}

interface NihongoWidgetsPlugin {
  update(options: { data: string }): Promise<void>;
  clear(): Promise<void>;
}

const NihongoWidgets = registerPlugin<NihongoWidgetsPlugin>('NihongoWidgets');

let lastSent: string | null = null;

/** Send the summary to the widgets. Skip a summary that did not change. */
export async function updateWidgets(snapshot: WidgetSnapshot) {
  const data = JSON.stringify(snapshot);
  if (data === lastSent) return;
  lastSent = data;
  try {
    await NihongoWidgets.update({ data });
  } catch {
    // Older native builds do not have the plugin.
    lastSent = null;
  }
}

export async function clearWidgets() {
  lastSent = null;
  try {
    await NihongoWidgets.clear();
  } catch {
    /* Older native builds do not have the plugin. */
  }
}
