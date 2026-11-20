import { useEffect, type RefObject } from 'react';
import { useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isMobileApp } from '../utils/nativeRuntime';
import Button from './ui/Button';
import Modal from './ui/Modal';

interface GuardProps {
  dirty: boolean;
  /** Set to true before a navigation that saves the draft, such as after a submit. */
  bypassRef?: RefObject<boolean>;
}

function WebUnsavedChangesGuard({ dirty, bypassRef }: GuardProps) {
  const { t } = useTranslation('nav');
  // A change of query string stays on the same form, so compare only the path.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !bypassRef?.current &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  // The router does not see a reload or a closed tab. The browser shows its own prompt.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!bypassRef?.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, bypassRef]);

  const keepEditing = () => {
    if (blocker.state === 'blocked') blocker.reset();
  };

  return (
    <Modal
      open={blocker.state === 'blocked'}
      onClose={keepEditing}
      title={t('native.unsavedTitle')}
      size="sm"
      actions={
        <>
          <Button appearance="ghost" onClick={keepEditing}>
            {t('native.keepEditing')}
          </Button>
          <Button
            variant="error"
            onClick={() => {
              if (blocker.state === 'blocked') blocker.proceed();
            }}
          >
            {t('native.discard')}
          </Button>
        </>
      }
    >
      <p>{t('native.unsavedMessage')}</p>
    </Modal>
  );
}

/**
 * Ask before a navigation discards a form draft on the web.
 * The native app has its own guard in `NativeNavigation`. Use `useNativeUnsavedChanges` there.
 * The router supports one blocker at a time.
 */
export default function UnsavedChangesGuard(props: GuardProps) {
  if (isMobileApp()) return null;
  return <WebUnsavedChangesGuard {...props} />;
}
