import { useQuery } from '@tanstack/react-query';
import { getFeatureFlagsFn } from '../api/trackerApi';

export function useFeatureFlags() {
  const { data } = useQuery({
    queryKey: ['featureFlags'],
    queryFn: getFeatureFlagsFn,
    staleTime: 5 * 60_000,
    meta: { silentError: true },
  });
  // Treat flags as off until the server answers.
  return data ?? { wrapped: false };
}
