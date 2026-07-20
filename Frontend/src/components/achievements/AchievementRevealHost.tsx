import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AchievementRevealModal from './AchievementRevealModal';
import { useAchievementRevealStore } from '../../store/achievementReveal';
import { useUserDataStore } from '../../store/userData';
import { getPendingAchievementsFn } from '../../api/trackerApi';
import { AchievementRarity, IPendingAchievement } from '../../types';

/**
 * Single global mount point for the achievement reveal modal.
 *
 * Achievements reach it from two directions:
 * - inline, pushed by `createLogFn` from the mutation response, so every
 *   log entry point (log screen, quick log, texthooker, shared log, playlist
 *   batches) reveals without wiring anything itself;
 * - on mount, by draining `/achievements/me/pending`, which covers unlocks
 *   granted outside a request the client saw (cron re-evaluation, imports).
 */

const DEMO: IPendingAchievement[] = [
  {
    userAchievementId: 'demo-1',
    unlockedAt: new Date().toISOString(),
    rarityPercent: 12,
    achievement: {
      _id: 'demo-1',
      key: 'demo.first-steps',
      name: 'First Steps',
      description: 'Logged your first immersion session.',
      category: 'milestone',
      rarity: 'common',
      iconSlug: 'walking-boot',
      isSecret: false,
      isHidden: false,
      points: 10,
      rarityPercent: 12,
    },
  },
  {
    userAchievementId: 'demo-2',
    unlockedAt: new Date().toISOString(),
    rarityPercent: 0.8,
    achievement: {
      _id: 'demo-2',
      key: 'demo.eternal-flame',
      name: 'Eternal Flame',
      description: 'Kept a 365-day immersion streak alive.',
      category: 'streaks',
      rarity: 'legendary',
      iconSlug: 'fire-dash',
      isSecret: false,
      isHidden: false,
      points: 200,
      rarityPercent: 0.8,
    },
  },
];

function buildDemo(rarity?: string): IPendingAchievement[] {
  if (!rarity || rarity === '1' || rarity === 'true') return DEMO;
  const single = DEMO[1];
  return [
    {
      ...single,
      achievement: {
        ...single.achievement,
        rarity: rarity as AchievementRarity,
      },
    },
  ];
}

export default function AchievementRevealHost() {
  const queue = useAchievementRevealStore((state) => state.queue);
  const suspended = useAchievementRevealStore((state) => state.suspended);
  const enqueue = useAchievementRevealStore((state) => state.enqueue);
  const close = useAchievementRevealStore((state) => state.close);
  // Select the username rather than the user object: the store hands back a new
  // object on every profile update, which would re-poll on each XP change.
  const username = useUserDataStore((state) => state.user?.username);
  const location = useLocation();
  const navigate = useNavigate();

  // Drain unlocks the client never saw a response for (cron, imports).
  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    getPendingAchievementsFn()
      .then((pending) => {
        if (!cancelled) enqueue(pending);
      })
      .catch(() => {
        // Achievement display is non-critical — stay silent.
      });

    return () => {
      cancelled = true;
    };
  }, [username, enqueue]);

  // On-demand preview: `?achievementDemo=1` (or `=legendary`, `=epic`, …)
  // and `window.previewAchievementReveal()` from the console.
  useEffect(() => {
    const demo = new URLSearchParams(location.search).get('achievementDemo');
    if (demo) {
      enqueue(buildDemo(demo));
      const params = new URLSearchParams(location.search);
      params.delete('achievementDemo');
      navigate(
        { pathname: location.pathname, search: params.toString() },
        { replace: true }
      );
    }
  }, [location.search, location.pathname, enqueue, navigate]);

  useEffect(() => {
    window.previewAchievementReveal = (rarity?: string) =>
      enqueue(buildDemo(rarity));

    return () => {
      delete window.previewAchievementReveal;
    };
  }, [enqueue]);

  if (suspended || queue.length === 0) return null;

  return <AchievementRevealModal achievements={queue} onClose={close} />;
}
