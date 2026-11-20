import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNativeDismiss } from '../../native/useNativeDismiss';

/**
 * Backdrop for a modal built from `<div className="modal modal-open">`.
 * That markup has no native dialog behavior.
 * This closes it on Escape and on the Android back button too.
 * Prefer the shared `Modal` for new dialogs.
 */
function ModalBackdrop({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common');
  useNativeDismiss(true, onClose);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop">
      <button type="button" tabIndex={-1} onClick={onClose}>
        {t('close')}
      </button>
    </div>
  );
}

export default ModalBackdrop;
