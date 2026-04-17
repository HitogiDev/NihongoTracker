import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import {
  getErrorMessage,
  isChunkLoadError,
  recoverFromChunkLoadFailure,
} from '../utils/chunkRecovery';

export function RouteErrorBoundary() {
  const routeError = useRouteError();
  const message = getErrorMessage(routeError);
  const isChunkError = isChunkLoadError(message);

  useEffect(() => {
    if (isChunkError) {
      recoverFromChunkLoadFailure();
    }
  }, [isChunkError]);

  if (isChunkError) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-semibold text-base-content">
            Updating app...
          </h1>
          <p className="text-base-content/70">
            A new version was deployed. Reloading to sync assets.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Reload now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-6">
      <div className="max-w-2xl space-y-3">
        <h1 className="text-2xl font-semibold text-base-content">
          Unexpected Application Error
        </h1>
        <p className="text-base-content/70 break-words">
          {message || 'Something went wrong while loading this page.'}
        </p>
      </div>
    </div>
  );
}
