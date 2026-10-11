import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const ONBOARDING_STEP_COUNT = 4;

interface OnboardingState {
  steps: Record<string, number>;
  start: (account: string) => void;
  setStep: (account: string, step: number) => void;
  finish: (account: string) => void;
}

export const useNativeOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      steps: {},
      start: (account) =>
        set((state) => ({ steps: { ...state.steps, [account]: 0 } })),
      setStep: (account, step) =>
        set((state) => ({
          steps: {
            ...state.steps,
            [account]: Math.max(0, Math.min(ONBOARDING_STEP_COUNT - 1, step)),
          },
        })),
      finish: (account) =>
        set((state) => {
          const steps = { ...state.steps };
          delete steps[account];
          return { steps };
        }),
    }),
    {
      name: "nihongo:native:onboarding",
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try {
            return localStorage.getItem(name);
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value);
          } catch {
            /* Keep onboarding progress in memory when storage is unavailable. */
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
          } catch {
            /* The in-memory state is already cleared. */
          }
        },
      })),
      partialize: (state) => ({ steps: state.steps }),
    },
  ),
);
