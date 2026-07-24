import { useState } from 'react';
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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const queryClient = useQueryClient();

  const { mutate: dismissLogs, isPending: isDismissing } = useMutation({
    mutationFn: () => dismissLogsFn(selectedLogs.map((log) => log._id)),
    onSuccess: () => {
      setShowConfirmModal(false);
      onDismissed();
      queryClient.invalidateQueries({ queryKey: ['untrackedLogs'] });
      toast.success(
        `Dismissed ${selectedLogs.length} log${
          selectedLogs.length !== 1 ? 's' : ''
        } from media matching`
      );
    },
    onError: (error) => {
      const errorMessage =
        error instanceof AxiosError
          ? error.response?.data.message || 'Server error while dismissing logs'
          : error instanceof Error
            ? error.message
            : 'Unknown error while dismissing logs';
      toast.error(errorMessage);
    },
  });

  return (
    <>
      {showConfirmModal && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Dismiss Logs</h3>
            <div className="py-4">
              <p className="mb-4">
                Dismiss {selectedLogs.length} log
                {selectedLogs.length !== 1 ? 's' : ''} from media matching?
                They will no longer show up here or count as unmatched logs.
              </p>
              <p className="text-sm text-base-content/70">
                Use this for logs that can't be assigned to a single media. The
                logs themselves are kept and still count towards your stats.
              </p>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-warning"
                disabled={isDismissing}
                onClick={() => dismissLogs()}
              >
                {isDismissing ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Dismissing...
                  </>
                ) : (
                  'Dismiss'
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
        className={`btn btn-outline btn-warning ${className}`}
        title="Dismiss selected logs from media matching"
      >
        <EyeOff className="h-5 w-5" />
        Dismiss
      </button>
    </>
  );
}

export default DismissLogsButton;
