import { QueryClient, QueryCache } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { isPrivateProfileError } from './utils/apiError';
import { isNativeApp } from './utils/nativeRuntime';

const queryClient = new QueryClient({
  defaultOptions: isNativeApp()
    ? {
        queries: { networkMode: 'always', retry: 0 },
        mutations: { networkMode: 'always' },
      }
    : undefined,
  queryCache: new QueryCache({
    onError: (error) => {
      if (isPrivateProfileError(error)) return;
      toast.error(error.message ? error.message : 'An error occurred');
    },
  }),
});

export default queryClient;
