import { useUserDataStore } from '../store/userData';

/** Viewer preference for whether competitive ranking UI should be rendered. */
export function useHideRankingFeatures(): boolean {
  return useUserDataStore(
    (state) => state.user?.settings?.hideRankingFeatures === true
  );
}
