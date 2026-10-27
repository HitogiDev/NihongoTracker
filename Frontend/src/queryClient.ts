import { QueryClient, QueryCache } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { isPrivateProfileError } from './utils/apiError';
import { isNativeApp } from './utils/nativeRuntime';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      /** Skip the global error toast. The component shows the failure itself. */
      silentError?: boolean;
    };
  }
}

const queryClient = new QueryClient({
  defaultOptions: isNativeApp()
    ? {
        queries: { networkMode: 'always', retry: 0 },
        mutations: { networkMode: 'always' },
      }
    : undefined,
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.silentError || isPrivateProfileError(error)) return;
      toast.error(error.message ? error.message : 'An error occurred');
    },
  }),
});

export default queryClient;
