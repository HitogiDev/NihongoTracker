import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pause, Play, Square, Timer, NotebookPen } from 'lucide-react';
import QuickLog, { type QuickLogInitialValues } from '../components/QuickLog';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { PageLoader } from '../components/ui/Spinner';
import { goalMediaTypeKey } from '../utils/goalMediaTypes';
import { buttonClass } from '../components/ui/buttons';
import useSessionElapsed, { formatSessionTime } from '../hooks/useSessionElapsed';
import {
  pauseSessionTimer,
  resumeSessionTimer,
  stopSessionTimer,
  useSessionTimerStore,
} from '../store/sessionTimer';
import { sessionElapsedMs } from '../native/sessionTimer';
import { sessionMediaDocument } from '../native/useStartSession';
import { haptic } from '../native/haptics';

/** Return to the previous screen through the native back rules. */
function goBack() {
  window.dispatchEvent(new Event('nihongo:native-back', { cancelable: true }));
}

/** Minutes to log. A started session logs at least one minute. */
function sessionLogValues(elapsedMs: number): QuickLogInitialValues {
  const total = Math.max(1, Math.floor(elapsedMs / 60000));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

export default function SessionTimerScreen() {
  const { t } = useTranslation('android');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useSessionTimerStore((store) => store.state);
  const ready = useSessionTimerStore((store) => store.ready);
  const elapsed = useSessionElapsed(state);
  const [logValues, setLogValues] = useState<QuickLogInitialValues | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const mediaKey = state ? `${state.media.type}:${state.media.contentId}` : '';
  const media = useMemo(
    () => (state ? sessionMediaDocument(state.media) : undefined),
    // Rebuild the document only for another media, so QuickLog keeps its form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mediaKey]
  );

  const openLog = async () => {
    const paused = state?.runningSince ? await pauseSessionTimer() : state;
    if (paused) setLogValues(sessionLogValues(sessionElapsedMs(paused)));
  };

  // The Log action of the notification opens this screen with ?log=1.
  const wantsLog = searchParams.get('log') === '1';
  useEffect(() => {
    if (!wantsLog || !ready) return;
    setSearchParams({}, { replace: true });
    if (state) void openLog();
    // Run once for each Log action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsLog, ready]);

  const toggle = async () => {
    setBusy(true);
    try {
      haptic('medium');
      if (state?.runningSince) await pauseSessionTimer();
      else await resumeSessionTimer();
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    setDiscardOpen(false);
    await stopSessionTimer();
    goBack();
  };

  if (!ready) return <PageLoader />;

  if (!state) {
    return (
      <div className="native-page">
        <div className="surface flex flex-col items-center gap-3 p-6 text-center">
          <Timer className="h-10 w-10 text-base-content/70" />
          <h2 className="text-lg font-semibold">{t('sessionTimer.empty')}</h2>
          <p className="text-sm text-base-content/70">{t('sessionTimer.emptyBody')}</p>
          <Link to="/" replace className={buttonClass({ variant: 'primary' })}>
            {t('sessionTimer.goHome')}
          </Link>
        </div>
      </div>
    );
  }

  const running = Boolean(state.runningSince);
  const cover = state.media.coverImage || state.media.contentImage;
  const blurred =
    state.media.type === 'vn' ? state.media.isAdultImage : state.media.isAdult;
  const startedAt = new Date(state.startedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="native-page space-y-4">
      <Link
        to={`/${state.media.type}/${state.media.contentId}`}
        className="surface flex items-center gap-4 p-4"
      >
        {cover && (
          <img
            src={cover}
            alt=""
            className={`h-24 w-16 shrink-0 rounded-box object-cover ${blurred ? 'blur-sm' : ''}`}
          />
        )}
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-base-content/70">
            {tCommon(`mediaTypes.${goalMediaTypeKey(state.media.type)}`)}
          </p>
          <h2 className="line-clamp-2 font-semibold">{state.title}</h2>
          <p className="text-xs text-base-content/70">
            {t('sessionTimer.startedAt', { time: startedAt })}
          </p>
        </div>
      </Link>

      <section className="surface flex flex-col items-center gap-2 px-4 py-8">
        <span
          className={`badge ${running ? 'badge-success' : 'badge-warning'}`}
        >
          {running ? t('sessionTimer.running') : t('sessionTimer.paused')}
        </span>
        <p
          className="font-mono text-[3.5rem] leading-none font-bold tabular-nums"
          aria-live="off"
        >
          {formatSessionTime(elapsed)}
        </p>
      </section>

      <div className="grid gap-3">
        <Button
          size="lg"
          block
          appearance={running ? 'outline' : 'solid'}
          variant={running ? 'default' : 'primary'}
          disabled={busy}
          onClick={() => void toggle()}
        >
          {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          {running ? t('sessionTimer.pause') : t('sessionTimer.resume')}
        </Button>
        <Button variant="primary" size="lg" block onClick={() => void openLog()}>
          <NotebookPen className="h-5 w-5" />
          {t('sessionTimer.log')}
        </Button>
        <Button
          appearance="ghost"
          variant="error"
          block
          onClick={() => setDiscardOpen(true)}
        >
          <Square className="h-4 w-4" />
          {t('sessionTimer.discard')}
        </Button>
      </div>

      <QuickLog
        open={logValues !== null}
        onClose={() => setLogValues(null)}
        media={media}
        initialValues={logValues ?? undefined}
        allowTimer={false}
        onLogged={async () => {
          await stopSessionTimer();
          navigate('/records', { replace: true });
        }}
      />

      <Modal
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title={t('sessionTimer.discardTitle')}
        actions={
          <>
            <Button appearance="ghost" onClick={() => setDiscardOpen(false)}>
              {t('sessionTimer.keep')}
            </Button>
            <Button variant="error" onClick={() => void discard()}>
              {t('sessionTimer.discard')}
            </Button>
          </>
        }
      >
        <p>{t('sessionTimer.discardBody')}</p>
      </Modal>
    </div>
  );
}
