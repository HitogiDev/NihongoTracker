import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import queryClient from '../queryClient';
import { persistOptions } from '../offline/queryPersistence';
import { isNativeApp } from '../utils/nativeRuntime';

/** The native app shows saved screens at once and refreshes them in the background. */
export default function QueryProvider({ children }: { children: ReactNode }) {
  return isNativeApp() ? (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
    >
      {children}
    </PersistQueryClientProvider>
  ) : (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
