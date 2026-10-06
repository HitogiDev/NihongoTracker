import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { assignMediaFn } from '../api/trackerApi';
import { getApiErrorMessage } from '../utils/apiError';
import { invalidateMediaAssignmentQueries } from '../utils/logQueryInvalidation';
import type { ILog } from '../types';

export function useMediaAssignment(options: {
  username?: string;
  type: ILog['type'];
  onAssigned: () => void;
  successMessage: string;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assignMediaFn,
    onSuccess: () => {
      options.onAssigned();
      invalidateMediaAssignmentQueries(
        queryClient,
        options.type,
        options.username
      );
      toast.success(options.successMessage);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
}
