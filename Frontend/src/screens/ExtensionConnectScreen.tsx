import { useMutation } from '@tanstack/react-query';
import { Check, CircleCheck, Copy, KeyRound, Puzzle, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { generateApiKeyFn } from '../api/trackerApi';
import Button from '../components/ui/Button';
import PageContainer from '../components/ui/PageContainer';
import Spinner from '../components/ui/Spinner';
import { buttonClass } from '../components/ui/buttons';
import { useUserDataStore } from '../store/userData';

/** Time to wait for the extension bridge before the page offers the manual key. */
const DETECT_TIMEOUT_MS = 4000;

type Detection = 'detecting' | 'detected' | 'missing';
type Result = { status: 'connected' } | { status: 'failed'; error: string } | { status: 'manual'; key: string };

interface BridgeMessage {
  type?: string;
  browser?: string;
  ok?: boolean;
  error?: string;
}

/**
 * Create an API key for the NTExtended browser extension.
 * The extension injects a bridge script into this tab. The bridge sends the key to the extension.
 * Keep the message types aligned with NTExtended `src/entrypoints/connect.ts`.
 */
function ExtensionConnectScreen() {
  const { t } = useTranslation('settings');
  const { user } = useUserDataStore();
  const [detection, setDetection] = useState<Detection>('detecting');
  const [browserName, setBrowserName] = useState('Browser');
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const waitingForReply = useRef(false);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent<BridgeMessage>) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.type === 'ntextended:hello') {
        setDetection('detected');
        if (typeof data.browser === 'string') setBrowserName(data.browser.slice(0, 20));
      }
      if (data?.type === 'ntextended:connected' && waitingForReply.current) {
        waitingForReply.current = false;
        setWaiting(false);
        setResult(data.ok ? { status: 'connected' } : { status: 'failed', error: data.error ?? '' });
      }
    };
    window.addEventListener('message', onMessage);
    window.postMessage({ type: 'ntextended:ping' }, window.location.origin);
    const timer = window.setTimeout(
      () => setDetection((current) => (current === 'detecting' ? 'missing' : current)),
      DETECT_TIMEOUT_MS
    );
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timer);
    };
  }, []);

  const keyName = `NTExtended (${browserName})`;

  const authorize = useMutation({
    mutationFn: () => generateApiKeyFn({ name: keyName }),
    onSuccess: ({ key }) => {
      if (detection !== 'detected') {
        setResult({ status: 'manual', key });
        return;
      }
      waitingForReply.current = true;
      setWaiting(true);
      window.postMessage({ type: 'ntextended:api-key', key }, window.location.origin);
      // Show the key when the extension does not reply, so the user can still paste it.
      window.setTimeout(() => {
        if (!waitingForReply.current) return;
        waitingForReply.current = false;
        setWaiting(false);
        setResult({ status: 'manual', key });
      }, DETECT_TIMEOUT_MS);
    },
    onError: () => setResult({ status: 'failed', error: t('extensionConnect.generateFailed') }),
  });

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const done = result?.status === 'connected' || result?.status === 'manual';

  return (
    <PageContainer width="md">
      <div className="card surface mx-auto max-w-lg">
        <div className="card-body gap-5">
          <div className="flex items-center gap-3">
            <div className="rounded-box bg-primary/10 p-3 text-primary">
              <Puzzle className="h-6 w-6" />
            </div>
            <h1 className="card-title text-2xl">{t('extensionConnect.title')}</h1>
          </div>
          <p className="text-base-content/70">{t('extensionConnect.intro')}</p>

          <div className="surface-muted p-4">
            <p className="text-sm font-medium">{t('extensionConnect.permissionsTitle')}</p>
            <ul className="mt-2 space-y-1.5 text-sm text-base-content/80">
              {[
                t('extensionConnect.permissionLogs'),
                t('extensionConnect.permissionRead'),
                t('extensionConnect.permissionKey', { name: keyName }),
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-base-content/60">{t('extensionConnect.revokeHint')}</p>
          </div>

          {!user && (
            <>
              <p className="text-sm text-base-content/70">{t('extensionConnect.loginRequired')}</p>
              <Link to="/login" className={buttonClass({ variant: 'primary', size: 'lg', block: true })}>
                {t('extensionConnect.login')}
              </Link>
            </>
          )}

          {user && detection === 'detecting' && (
            <p className="flex items-center gap-2 text-sm text-base-content/70">
              <Spinner size="sm" />
              {t('extensionConnect.detecting')}
            </p>
          )}
          {user && detection === 'missing' && !result && (
            <div role="alert" className="alert alert-warning alert-soft text-sm">
              <TriangleAlert className="h-5 w-5" />
              <span>{t('extensionConnect.notDetected')}</span>
            </div>
          )}

          {result?.status === 'connected' && (
            <div role="status" className="alert alert-success alert-soft">
              <CircleCheck className="h-5 w-5" />
              <span>{t('extensionConnect.connected')}</span>
            </div>
          )}
          {result?.status === 'failed' && (
            <div role="alert" className="alert alert-error alert-soft text-sm">
              <TriangleAlert className="h-5 w-5" />
              <span>{t('extensionConnect.failed', { error: result.error })}</span>
            </div>
          )}
          {result?.status === 'manual' && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <KeyRound className="h-4 w-4 text-primary" />
                {t('extensionConnect.manualKey')}
              </p>
              <div className="join w-full">
                <input
                  readOnly
                  className="input join-item w-full font-mono text-xs"
                  value={result.key}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <button type="button" className="join-item btn" onClick={() => void copyKey(result.key)}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? t('extensionConnect.copied') : t('extensionConnect.copy')}
                </button>
              </div>
            </div>
          )}

          {user && !done && (
            <Button
              variant="primary"
              size="lg"
              block
              loading={authorize.isPending || waiting}
              loadingText={t('extensionConnect.authorizing')}
              disabled={detection === 'detecting'}
              onClick={() => authorize.mutate()}
            >
              {t('extensionConnect.authorize')}
            </Button>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

export default ExtensionConnectScreen;
