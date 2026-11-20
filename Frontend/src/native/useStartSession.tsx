import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import type { IMediaDocument } from '../types';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { useUserDataStore } from '../store/userData';
import {
  startSessionTimer,
  useSessionTimerStore,
} from '../store/sessionTimer';
import { ensureSessionNotifications, type SessionMedia } from './sessionTimer';
import { haptic } from './haptics';

/** Localized notification labels. Keep the keys aligned with SessionTimerNotification.java. */
export function useSessionLabels() {
  const { t } = useTranslation('android');
  return useMemo(
    () => ({
      channel: t('sessionTimer.notification.channel'),
      running: t('sessionTimer.notification.running'),
      paused: t('sessionTimer.notification.paused'),
      pause: t('sessionTimer.notification.pause'),
      resume: t('sessionTimer.notification.resume'),
      log: t('sessionTimer.notification.log'),
    }),
    [t]
  );
}

export function toSessionMedia(media: IMediaDocument): SessionMedia {
  return {
    contentId: media.contentId,
    type: media.type,
    title: {
      contentTitleNative: media.title.contentTitleNative,
      contentTitleRomaji: media.title.contentTitleRomaji,
      contentTitleEnglish: media.title.contentTitleEnglish,
    },
    contentImage: media.contentImage,
    coverImage: media.coverImage,
    isAdult: media.isAdult ?? false,
    isAdultImage: media.isAdultImage ?? false,
    episodes: media.episodes,
    episodeDuration: media.episodeDuration,
    runtime: media.runtime,
    volumes: media.volumes,
  };
}

export function sessionMediaDocument(media: SessionMedia): IMediaDocument {
  return { ...media } as IMediaDocument;
}

/**
 * Start a session for a media and open the timer screen.
 * Render `dialog`. It asks before an active session of another media is replaced.
 */
export function useStartSession() {
  const { t } = useTranslation('android');
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const user = useUserDataStore((store) => store.user);
  const active = useSessionTimerStore((store) => store.state);
  const labels = useSessionLabels();
  const [pending, setPending] = useState<{
    media: IMediaDocument;
    onStarted?: () => void;
  } | null>(null);
  const [starting, setStarting] = useState(false);

  const openSession = useCallback(
    () => navigate('/session', { state: { nativeFrom: `${pathname}${search}` } }),
    [navigate, pathname, search]
  );

  const begin = useCallback(
    async (media: IMediaDocument, onStarted?: () => void) => {
      if (!user) return;
      setStarting(true);
      try {
        const allowed = await ensureSessionNotifications();
        await startSessionTimer({
          userId: user._id,
          title: media.title.contentTitleNative,
          media: toSessionMedia(media),
          labels,
        });
        haptic('medium');
        if (!allowed) toast.info(t('sessionTimer.notificationsOff'));
        onStarted?.();
        openSession();
      } catch {
        toast.error(t('sessionTimer.notificationsOff'));
      } finally {
        setStarting(false);
        setPending(null);
      }
    },
    [user, labels, openSession, t]
  );

  const start = useCallback(
    (media: IMediaDocument, onStarted?: () => void) => {
      if (active?.media.contentId === media.contentId && active.media.type === media.type) {
        onStarted?.();
        openSession();
      } else if (active) {
        setPending({ media, onStarted });
      } else {
        void begin(media, onStarted);
      }
    },
    [active, begin, openSession]
  );

  const dialog = (
    <Modal
      open={pending !== null}
      onClose={() => setPending(null)}
      title={t('sessionTimer.replaceTitle')}
      actions={
        <>
          <Button
            appearance="ghost"
            onClick={() => {
              const onStarted = pending?.onStarted;
              setPending(null);
              onStarted?.();
              openSession();
            }}
          >
            {t('sessionTimer.openCurrent')}
          </Button>
          <Button
            variant="primary"
            loading={starting}
            onClick={() => pending && void begin(pending.media, pending.onStarted)}
          >
            {t('sessionTimer.replace')}
          </Button>
        </>
      }
    >
      <p>{t('sessionTimer.replaceBody', { title: active?.title ?? '' })}</p>
    </Modal>
  );

  return { start, starting, dialog };
}
