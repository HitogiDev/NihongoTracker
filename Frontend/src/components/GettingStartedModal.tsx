import { BookOpenCheck, CalendarClock, FileUp, Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Modal from './ui/Modal';

interface GettingStartedModalProps {
  open: boolean;
  onClose: () => void;
}

export default function GettingStartedModal({
  open,
  onClose,
}: GettingStartedModalProps) {
  const { t } = useTranslation('home');

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-2">
          <BookOpenCheck className="size-5 text-primary" />
          {t('onboarding.title')}
        </span>
      }
      actions={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="btn btn-ghost" onClick={onClose}>
            {t('onboarding.later')}
          </button>
          <Link className="btn btn-primary" to="/log" onClick={onClose}>
            {t('onboarding.startLogging')}
          </Link>
        </div>
      }
    >
      <p className="mb-5 text-sm leading-relaxed text-base-content/70 sm:text-base">
        {t('onboarding.subtitle')}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <section className="card surface-muted">
          <div className="card-body gap-3 p-4">
            <BookOpenCheck className="size-6 text-primary" />
            <h3 className="card-title text-base">
              {t('onboarding.logTitle')}
            </h3>
            <p className="text-sm leading-relaxed text-base-content/70">
              {t('onboarding.logBody')}
            </p>
          </div>
        </section>

        <section className="card surface-muted">
          <div className="card-body gap-3 p-4">
            <FileUp className="size-6 text-info" />
            <h3 className="card-title text-base">
              {t('onboarding.importTitle')}
            </h3>
            <p className="text-sm leading-relaxed text-base-content/70">
              {t('onboarding.importBody')}
            </p>
            <Link
              className="link link-primary text-sm font-medium"
              to="/settings?tab=advanced"
              onClick={onClose}
            >
              {t('onboarding.importLink')}
            </Link>
          </div>
        </section>

        <section className="card surface-muted sm:col-span-2 lg:col-span-1">
          <div className="card-body gap-3 p-4">
            <CalendarClock className="size-6 text-secondary" />
            <h3 className="card-title text-base">
              {t('onboarding.whenTitle')}
            </h3>
            <p className="text-sm leading-relaxed text-base-content/70">
              {t('onboarding.whenBody')}
            </p>
          </div>
        </section>
      </div>

      <div role="alert" className="alert alert-info mt-4 items-start">
        <Scale className="mt-0.5 size-5 shrink-0" />
        <p className="text-sm leading-relaxed">
          {t('onboarding.unknownDate')}
        </p>
      </div>

      <p className="mt-4 text-sm text-base-content/70">
        {t('onboarding.guidelinesPrefix')}{' '}
        <Link
          to="/guidelines"
          className="link link-primary font-medium"
          onClick={onClose}
        >
          {t('onboarding.guidelinesLink')}
        </Link>
        .
      </p>
    </Modal>
  );
}
