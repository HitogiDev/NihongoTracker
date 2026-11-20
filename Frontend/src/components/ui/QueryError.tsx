import { CircleAlert, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage } from '../../utils/apiError';
import Button from './Button';

interface QueryErrorProps {
  /** The value from the failed query. Its message replaces the default text. */
  error?: unknown;
  /** Usually the `refetch` function of the query. */
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

/** Show a failed load in the page, with a retry action. */
function QueryError({
  error,
  onRetry,
  retrying = false,
  className = '',
}: QueryErrorProps) {
  const { t } = useTranslation('common');

  return (
    <div
      role="alert"
      className={`flex flex-col items-center gap-3 px-4 py-10 text-center ${className}`}
    >
      <CircleAlert className="h-8 w-8 text-error" aria-hidden="true" />
      <p className="text-base-content/80">
        {error ? getApiErrorMessage(error) : t('errors.loadFailed')}
      </p>
      {onRetry && (
        <Button size="sm" loading={retrying} onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t('errors.retry')}
        </Button>
      )}
    </div>
  );
}

export default QueryError;
