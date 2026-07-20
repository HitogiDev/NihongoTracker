import { create } from 'zustand';
import { IAchievement, IPendingAchievement } from '../types';

interface AchievementRevealState {
  queue: IPendingAchievement[];
  /** While true the reveal modal stays hidden (e.g. log celebration on top). */
  suspended: boolean;
  /** Enqueue already-shaped pending achievements (e.g. from /me/pending). */
  enqueue: (items: IPendingAchievement[]) => void;
  /** Enqueue raw achievements returned inline by a mutation response. */
  enqueueAchievements: (achievements: IAchievement[]) => void;
  suspend: () => void;
  resume: () => void;
  close: () => void;
}

export const useAchievementRevealStore = create<AchievementRevealState>(
  (set) => ({
    queue: [],
    suspended: false,

    enqueue: (items) =>
      set((state) => {
        if (items.length === 0) return state;
        const seen = new Set(state.queue.map((i) => i.userAchievementId));
        const fresh = items.filter((i) => !seen.has(i.userAchievementId));
        if (fresh.length === 0) return state;
        return { queue: [...state.queue, ...fresh] };
      }),

    enqueueAchievements: (achievements) =>
      set((state) => {
        if (!achievements || achievements.length === 0) return state;
        const seen = new Set(state.queue.map((i) => i.userAchievementId));
        const fresh = achievements
          .map<IPendingAchievement>((a) => ({
            userAchievementId: a._id,
            unlockedAt: new Date().toISOString(),
            achievement: a,
            rarityPercent: a.rarityPercent ?? 0,
          }))
          .filter((i) => !seen.has(i.userAchievementId));
        if (fresh.length === 0) return state;
        return { queue: [...state.queue, ...fresh] };
      }),

    suspend: () => set({ suspended: true }),
    resume: () => set({ suspended: false }),

    close: () => set({ queue: [] }),
  })
);

/** Hold the reveal modal back while another celebration overlay is showing. */
export function suspendAchievementReveal() {
  useAchievementRevealStore.getState().suspend();
}

export function resumeAchievementReveal() {
  useAchievementRevealStore.getState().resume();
}

/** Push newly unlocked achievements from anywhere (API layer, mutations, …). */
export function revealAchievements(achievements?: IAchievement[]) {
  if (!achievements || achievements.length === 0) return;
  useAchievementRevealStore.getState().enqueueAchievements(achievements);
}
