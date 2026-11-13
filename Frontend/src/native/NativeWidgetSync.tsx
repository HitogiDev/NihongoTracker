import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getDailyGoalsFn, getUserFn } from '../api/trackerApi';
import { useUserDataStore } from '../store/userData';
import { getDayKeyInTimezone, shiftByDayStart } from '../utils/timezone';
import { goalMediaTypeKey } from '../utils/goalMediaTypes';
import { clearWidgets, updateWidgets, type WidgetSnapshot } from './widgets';

function weekStartKey(dayKey: string, weekStartsOn: number) {
  const date = new Date(`${dayKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dayKey;
  const back = (date.getUTCDay() - weekStartsOn + 7) % 7;
  date.setUTCDate(date.getUTCDate() - back);
  return date.toISOString().slice(0, 10);
}

function utcDayKey(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

/**
 * Send the streak, level, and goal progress to the Android home screen widgets.
 * The queries share their keys with the dashboard and goals screens.
 * Log changes invalidate those keys, so the widgets update after each log.
 */
export default function NativeWidgetSync() {
  const { t } = useTranslation(['android', 'goals', 'common']);
  const user = useUserDataStore((store) => store.user);
  const username = user?.username;

  const { data: profile } = useQuery({
    queryKey: ['user', username],
    queryFn: () => getUserFn(username!),
    enabled: !!username,
    staleTime: 1000 * 60,
  });
  const { data: goalsData } = useQuery({
    queryKey: [username, 'dailyGoals'],
    queryFn: () => getDailyGoalsFn(username),
    enabled: !!username,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!user) {
      void clearWidgets();
      return;
    }
    const settings = user.settings;
    const timezone =
      settings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const dayStartHour = settings?.dayStartHour ?? 0;
    const weekStartsOn = settings?.weekStartsOn ?? 1;
    const stats = profile?.stats ?? user.stats;
    const dayKey = getDayKeyInTimezone(
      shiftByDayStart(new Date(), dayStartHour),
      timezone
    );
    const levelSpan =
      (stats?.userXpToNextLevel ?? 0) - (stats?.userXpToCurrentLevel ?? 0);
    const goals = (goalsData?.goals ?? [])
      .filter((goal) => goal.isActive && goal._id)
      .sort(
        (a, b) =>
          Number(a.cadence === 'weekly') - Number(b.cadence === 'weekly')
      )
      .map((goal) => {
        const cadence = goal.cadence === 'weekly' ? 'weekly' : 'daily';
        const type = t(`goals:types.${goal.type}`);
        const base = goal.mediaType
          ? t('android:widgets.goal', {
              type,
              media: t(`common:mediaTypes.${goalMediaTypeKey(goal.mediaType)}`),
            })
          : type;
        return {
          label:
            cadence === 'weekly'
              ? t('android:widgets.weekly', { goal: base })
              : base,
          type: goal.type,
          cadence,
          progress: goalsData?.goalProgress?.[goal._id ?? ''] ?? 0,
          target: goal.target,
        } satisfies WidgetSnapshot['goals'][number];
      });

    void updateWidgets({
      timezone,
      dayStartHour,
      weekStartsOn,
      dayKey,
      weekKey: weekStartKey(dayKey, weekStartsOn),
      streak: stats?.currentStreak ?? 0,
      lastStreakDay: utcDayKey(stats?.lastStreakDate),
      level: stats?.userLevel ?? 1,
      levelProgress:
        levelSpan > 0
          ? ((stats?.userXp ?? 0) - (stats?.userXpToCurrentLevel ?? 0)) /
            levelSpan
          : 0,
      goals,
      labels: {
        streakOne: t('android:widgets.streakOne'),
        streakOther: t('android:widgets.streakOther'),
        loggedToday: t('android:widgets.loggedToday'),
        keepStreak: t('android:widgets.keepStreak'),
        startStreak: t('android:widgets.startStreak'),
        level: t('android:widgets.level'),
        today: t('android:widgets.today'),
        noGoals: t('android:widgets.noGoals'),
        allDone: t('android:widgets.allDone'),
      },
    });
  }, [user, profile, goalsData, t]);

  return null;
}
