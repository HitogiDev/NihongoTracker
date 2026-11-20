import { Pause, Play, NotebookPen } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '../components/ui/Button';
import useSessionElapsed, { formatSessionTime } from '../hooks/useSessionElapsed';
import {
  pauseSessionTimer,
  resumeSessionTimer,
  useSessionTimerStore,
} from '../store/sessionTimer';
import { haptic } from './haptics';

/** Compact controls for the active session on every screen except the timer screen. */
export default function NativeSessionBar() {
  const { t } = useTranslation('android');
  const { pathname, search } = useLocation();
  const state = useSessionTimerStore((store) => store.state);
  const elapsed = useSessionElapsed(state);
  if (!state || pathname === '/session') return null;

  const running = Boolean(state.runningSince);
  const from = { nativeFrom: `${pathname}${search}` };
  const cover = state.media.coverImage || state.media.contentImage;
  const blurred =
    state.media.type === 'vn' ? state.media.isAdultImage : state.media.isAdult;

  return (
    <div className="native-session-bar surface-raised flex items-center gap-2 p-2 shadow-lg">
      <Link
        to="/session"
        state={from}
        className="flex min-w-0 flex-1 items-center gap-3"
        aria-label={t('sessionTimer.openSession')}
      >
        {cover && (
          <img
            src={cover}
            alt=""
            className={`h-10 w-7 shrink-0 rounded-box object-cover ${blurred ? 'blur-xs' : ''}`}
          />
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{state.title}</span>
          <span
            className={`block font-mono text-xs tabular-nums ${running ? 'text-success' : 'text-base-content/70'}`}
          >
            {formatSessionTime(elapsed)}
            {running ? '' : ` · ${t('sessionTimer.paused')}`}
          </span>
        </span>
      </Link>
      <Button
        appearance="ghost"
        size="sm"
        shape="square"
        aria-label={running ? t('sessionTimer.pause') : t('sessionTimer.resume')}
        onClick={() => {
          haptic('medium');
          void (running ? pauseSessionTimer() : resumeSessionTimer());
        }}
      >
        {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </Button>
      <Link
        to="/session?log=1"
        state={from}
        className="btn btn-primary btn-sm btn-square"
        aria-label={t('sessionTimer.log')}
      >
        <NotebookPen className="h-5 w-5" />
      </Link>
    </div>
  );
}
