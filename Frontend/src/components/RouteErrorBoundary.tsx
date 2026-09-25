import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getErrorMessage,
  isChunkLoadError,
  recoverFromChunkLoadFailure,
} from '../utils/chunkRecovery';

export function RouteErrorBoundary() {
  const { t } = useTranslation('common');
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
            {t('routeError.updatingTitle')}
          </h1>
          <p className="text-base-content/70">{t('routeError.updatingBody')}</p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            {t('routeError.reload')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-6">
      <div className="max-w-2xl space-y-3">
        <h1 className="text-2xl font-semibold text-base-content">
          {t('routeError.title')}
        </h1>
        <p className="text-base-content/70 break-words">
          {message || t('routeError.generic')}
        </p>
      </div>
    </div>
  );
}
