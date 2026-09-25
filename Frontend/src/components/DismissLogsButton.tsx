import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import { EyeOff } from 'lucide-react';
import { ILog } from '../types';
import { dismissLogsFn } from '../api/trackerApi';

interface DismissLogsButtonProps {
  selectedLogs: ILog[];
  onDismissed: () => void;
  className?: string;
}

function DismissLogsButton({
  selectedLogs,
  onDismissed,
  className = 'btn-lg',
}: DismissLogsButtonProps) {
  const { t } = useTranslation(['logs', 'common']);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const queryClient = useQueryClient();

  const { mutate: dismissLogs, isPending: isDismissing } = useMutation({
    mutationFn: () => dismissLogsFn(selectedLogs.map((log) => log._id)),
    onSuccess: () => {
      setShowConfirmModal(false);
      onDismissed();
      queryClient.invalidateQueries({ queryKey: ['untrackedLogs'] });
      toast.success(t('dismiss.success', { count: selectedLogs.length }));
    },
    onError: (error) => {
      const errorMessage =
        error instanceof AxiosError
          ? error.response?.data.message || t('dismiss.serverError')
          : error instanceof Error
            ? error.message
            : t('dismiss.unknownError');
      toast.error(errorMessage);
    },
  });

  return (
    <>
      {showConfirmModal && (
        <dialog open className="modal modal-bottom sm:modal-middle modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{t('dismiss.title')}</h3>
            <div className="py-4">
              <p className="mb-4">
                {t('dismiss.confirmBody', { count: selectedLogs.length })}
              </p>
              <p className="text-sm text-base-content/70">
                {t('dismiss.note')}
              </p>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setShowConfirmModal(false)}
              >
                {t('common:cancel')}
              </button>
              <button
                className="btn btn-warning"
                disabled={isDismissing}
                onClick={() => dismissLogs()}
              >
                {isDismissing ? (
                  <>
                    <span className="loading loading-spinner loading-md"></span>
                    {t('dismiss.dismissing')}
                  </>
                ) : (
                  t('dismiss.action')
                )}
              </button>
            </div>
          </div>
          <form
            method="dialog"
            className="modal-backdrop"
            onClick={() => setShowConfirmModal(false)}
          >
            <button>close</button>
          </form>
        </dialog>
      )}

      <button
        onClick={() => setShowConfirmModal(true)}
        disabled={isDismissing || selectedLogs.length === 0}
        className={`btn btn-warning btn-outline ${className}`}
        title={t('dismiss.hint')}
      >
        <EyeOff className="h-5 w-5" />
        {t('dismiss.action')}
      </button>
    </>
  );
}

export default DismissLogsButton;
