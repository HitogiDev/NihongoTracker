import { useEffect } from 'react';
import { ILogCelebration } from '../types';
import LogCelebration from './LogCelebration';
import { useLogCelebrationStore } from '../store/logCelebration';
import {
  suspendAchievementReveal,
  resumeAchievementReveal,
} from '../store/achievementReveal';

/**
 * Global mount point for the post-log celebration overlay. Fed by
 * `celebrateLog` from `createLogFn`, so every log entry point (log screen,
 * quick log, texthooker, shared log, playlist batches) triggers it without
 * wiring anything itself.
 *
 * While a celebration is showing, the achievement reveal modal is suspended
 * so the sequence reads: XP/level/rank first, then achievement cards.
 */
const DEMO: ILogCelebration = {
  xpGained: 245,
  streak: 12,
  levelUp: { from: 14, to: 15 },
  xp: { current: 15320, toCurrentLevel: 15000, toNextLevel: 16800, level: 15 },
  rank: {
    timeframe: 'month',
    rank: 3,
    previousRank: 5,
    overtaken: [
      { username: 'sakura_reads', xp: 15100 },
      { username: 'kenji42', xp: 15060 },
    ],
  },
};

export default function LogCelebrationHost() {
  const pending = useLogCelebrationStore((state) => state.pending);
  const celebrate = useLogCelebrationStore((state) => state.celebrate);
  const close = useLogCelebrationStore((state) => state.close);

  useEffect(() => {
    if (pending) {
      suspendAchievementReveal();
      return () => resumeAchievementReveal();
    }
  }, [pending]);

  // On-demand preview from the console, mirroring previewAchievementReveal.
  useEffect(() => {
    window.previewLogCelebration = (overrides?: Partial<ILogCelebration>) =>
      celebrate({ ...DEMO, ...overrides });

    return () => {
      delete window.previewLogCelebration;
    };
  }, [celebrate]);

  if (!pending) return null;

  return <LogCelebration celebration={pending} onClose={close} />;
}
