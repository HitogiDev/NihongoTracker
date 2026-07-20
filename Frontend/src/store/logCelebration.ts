import { create } from 'zustand';
import { ILogCelebration } from '../types';

interface LogCelebrationState {
  pending: ILogCelebration | null;
  celebrate: (payload?: ILogCelebration) => void;
  close: () => void;
}

export const useLogCelebrationStore = create<LogCelebrationState>((set) => ({
  pending: null,

  celebrate: (payload) =>
    set((state) => {
      if (!payload) return state;
      if (!state.pending) return { pending: payload };
      // Coalesce rapid-fire logs (playlist batches): accumulate XP, keep the
      // freshest snapshot of everything else, and preserve the earliest
      // level-up bounds so it still animates from→to across the whole batch.
      const merged: ILogCelebration = {
        ...payload,
        xpGained: state.pending.xpGained + payload.xpGained,
        levelUp:
          state.pending.levelUp || payload.levelUp
            ? {
                from:
                  state.pending.levelUp?.from ??
                  payload.levelUp?.from ??
                  payload.xp.level,
                to: payload.levelUp?.to ?? state.pending.levelUp?.to ?? payload.xp.level,
              }
            : undefined,
      };
      if (merged.levelUp && merged.levelUp.to <= merged.levelUp.from) {
        merged.levelUp = undefined;
      }
      return { pending: merged };
    }),

  close: () => set({ pending: null }),
}));

/** Push a celebration from anywhere (API layer, mutations, …). */
export function celebrateLog(payload?: ILogCelebration) {
  if (!payload) return;
  useLogCelebrationStore.getState().celebrate(payload);
}
