import { useState } from 'react';
import {
  BookOpenCheck,
  CalendarClock,
  Clock3,
  FileUp,
  Scale,
} from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Button from './ui/Button';
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
  const [step, setStep] = useState(0);
  const stepCount = 3;

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
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {step > 0 && (
              <Button appearance="ghost" onClick={() => setStep(step - 1)}>
                {t('onboarding.back')}
              </Button>
            )}
            {step < stepCount - 1 ? (
              <Button variant="primary" onClick={() => setStep(step + 1)}>
                {t('onboarding.next')}
              </Button>
            ) : (
              <Link className="btn btn-primary" to="/log" onClick={onClose}>
                {t('onboarding.startLogging')}
              </Link>
            )}
          </div>
        </div>
      }
    >
      <p className="mb-4 text-sm leading-relaxed text-base-content/70 sm:text-base">
        {t('onboarding.subtitle')}
      </p>

      <div className="mb-4 flex items-center justify-between gap-4">
        <span className="text-sm text-base-content/65">
          {t('onboarding.stepCounter', {
            current: step + 1,
            total: stepCount,
          })}
        </span>
        <progress
          className="progress progress-primary w-32"
          value={step + 1}
          max={stepCount}
          aria-label={t('onboarding.stepCounter', {
            current: step + 1,
            total: stepCount,
          })}
        />
      </div>

      {step === 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
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
      )}

      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
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
          <section className="card surface-muted">
            <div className="card-body gap-3 p-4">
              <Clock3 className="size-6 text-primary" />
              <h3 className="card-title text-base">
                {t('onboarding.manualTotalsTitle')}
              </h3>
              <p className="text-sm leading-relaxed text-base-content/70">
                <Trans
                  i18nKey="onboarding.manualTotals"
                  ns="home"
                  components={{
                    settings: (
                      <Link
                        to="/settings?tab=advanced#manual-immersion-settings"
                        className="link link-primary font-medium"
                        onClick={onClose}
                      />
                    ),
                  }}
                />
              </p>
            </div>
          </section>
        </div>
      )}

      {step === 2 && (
        <>
          <section className="card surface-muted">
            <div className="card-body gap-3 p-4">
              <Scale className="size-6 text-secondary" />
              <h3 className="card-title text-base">
                {t('onboarding.beFair')}
              </h3>
              <p className="text-sm leading-relaxed text-base-content/70">
                {t('onboarding.unknownDate')}
              </p>
            </div>
          </section>
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
        </>
      )}
    </Modal>
  );
}
