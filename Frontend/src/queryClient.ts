import { QueryClient, QueryCache } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { isPrivateProfileError } from './utils/apiError';

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (isPrivateProfileError(error)) return;
      toast.error(error.message ? error.message : 'An error occurred');
    },
  }),
});

export default queryClient;
