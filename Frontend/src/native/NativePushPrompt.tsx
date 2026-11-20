import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '../components/ui/Button';
import { useUserDataStore } from '../store/userData';
import {
  dismissPushPrompt,
  requestPushPermission,
  usePushPermissionStore,
} from './useNativePush';

/**
 * Explain the benefit of notifications before Android shows its permission dialog.
 * Android shows that dialog only a limited number of times.
 */
export default function NativePushPrompt() {
  const { t } = useTranslation('nav');
  const accountId = useUserDataStore((state) => state.user?._id);
  const status = usePushPermissionStore((state) => state.status);
  const [busy, setBusy] = useState(false);

  if (!accountId || status !== 'prompt') return null;

  return (
    <section
      className="surface mx-4 mt-4 flex items-start gap-3 p-4"
      aria-labelledby="native-push-title"
    >
      <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <h2 id="native-push-title" className="font-semibold">
            {t('native.pushTitle')}
          </h2>
          <p className="text-sm text-base-content/70">{t('native.pushBody')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={busy}
            onClick={() => {
              setBusy(true);
              void requestPushPermission()
                .catch(() => usePushPermissionStore.setState({ status: 'denied' }))
                .finally(() => setBusy(false));
            }}
          >
            {t('native.pushEnable')}
          </Button>
          <Button
            appearance="ghost"
            size="sm"
            onClick={() => dismissPushPrompt(accountId)}
          >
            {t('native.pushLater')}
          </Button>
        </div>
      </div>
    </section>
  );
}
