import { useTranslation } from 'react-i18next';
import { useConfirmStore } from '../../utils/confirmDialog';
import Button from './Button';
import Modal from './Modal';

/** Show the requests from `confirmDialog()` in `utils/confirmDialog.ts`. */
export function ConfirmDialogHost() {
  const { t } = useTranslation('common');
  const request = useConfirmStore((state) => state.request);

  const answer = (confirmed: boolean) => {
    request?.resolve(confirmed);
    useConfirmStore.setState({ request: null });
  };

  return (
    <Modal
      open={Boolean(request)}
      onClose={() => answer(false)}
      title={request?.title ?? t('confirmTitle')}
      size="sm"
      actions={
        <>
          <Button appearance="ghost" onClick={() => answer(false)}>
            {t('cancel')}
          </Button>
          <Button
            variant={request?.destructive ? 'error' : 'primary'}
            onClick={() => answer(true)}
          >
            {request?.confirmLabel ??
              (request?.destructive ? t('delete') : t('confirm'))}
          </Button>
        </>
      }
    >
      <p className="whitespace-pre-line">{request?.message}</p>
    </Modal>
  );
}
