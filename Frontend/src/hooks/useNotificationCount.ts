import { useQuery } from '@tanstack/react-query';
import { useUserDataStore } from '../store/userData';
import { getNotificationSummaryFn } from '../api/notificationsApi';

export function useNotificationCount() {
  const { user } = useUserDataStore();
  const { data } = useQuery({
    queryKey: ['notifications', 'summary'],
    queryFn: getNotificationSummaryFn,
    enabled: Boolean(user),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
  return data?.totalCount ?? 0;
}
