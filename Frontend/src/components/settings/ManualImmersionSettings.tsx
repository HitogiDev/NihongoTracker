import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { addManualImmersionFn } from '../../api/trackerApi';
import Button from '../ui/Button';
import Field from '../ui/Field';

type ImmersionMode = 'split' | 'total';

export default function ManualImmersionSettings() {
  const { t } = useTranslation('settings');
  const { hash } = useLocation();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<ImmersionMode>('split');
  const [readingHours, setReadingHours] = useState('');
  const [listeningHours, setListeningHours] = useState('');
  const [totalHours, setTotalHours] = useState('');
  const [chars, setChars] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'total'
        ? addManualImmersionFn({
            mode,
            totalHours: Number(totalHours || 0),
            chars: Number(chars || 0),
          })
        : addManualImmersionFn({
            mode,
            readingHours: Number(readingHours || 0),
            listeningHours: Number(listeningHours || 0),
            chars: Number(chars || 0),
          }),
    onSuccess: () => {
      setReadingHours('');
      setListeningHours('');
      setTotalHours('');
      setChars('');
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
    },
  });

  const parsedReading = Number(readingHours || 0);
  const parsedListening = Number(listeningHours || 0);
  const parsedTotal = Number(totalHours || 0);
  const parsedChars = Number(chars || 0);
  const hasHours =
    mode === 'total'
      ? parsedTotal > 0
      : parsedReading > 0 || parsedListening > 0;
  const hasValues = hasHours || parsedChars > 0;

  useEffect(() => {
    if (hash !== '#manual-immersion-settings') return;
    const scrollTimeout = window.setTimeout(() => {
      document
        .getElementById('manual-immersion-settings')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.clearTimeout(scrollTimeout);
  }, [hash]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <section
      id="manual-immersion-settings"
      className="surface-muted scroll-mt-24 space-y-4 p-4 sm:p-5"
    >
      <div>
        <h3 className="font-semibold">{t('manualImmersion.title')}</h3>
        <p className="mt-1 text-sm text-base-content/70">
          {t('manualImmersion.description')}
        </p>
      </div>

      <div className="join" role="group" aria-label={t('manualImmersion.mode')}>
        <Button
          type="button"
          className="join-item"
          variant={mode === 'split' ? 'primary' : 'default'}
          appearance={mode === 'split' ? 'solid' : 'outline'}
          aria-pressed={mode === 'split'}
          onClick={() => setMode('split')}
        >
          {t('manualImmersion.splitMode')}
        </Button>
        <Button
          type="button"
          className="join-item"
          variant={mode === 'total' ? 'primary' : 'default'}
          appearance={mode === 'total' ? 'solid' : 'outline'}
          aria-pressed={mode === 'total'}
          onClick={() => setMode('total')}
        >
          {t('manualImmersion.totalMode')}
        </Button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === 'split' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('manualImmersion.readingHours')}>
              {(id) => (
                <input
                  id={id}
                  className="input w-full"
                  type="number"
                  min="0"
                  max="100000"
                  step="0.1"
                  value={readingHours}
                  onChange={(event) => setReadingHours(event.target.value)}
                />
              )}
            </Field>
            <Field label={t('manualImmersion.listeningHours')}>
              {(id) => (
                <input
                  id={id}
                  className="input w-full"
                  type="number"
                  min="0"
                  max="100000"
                  step="0.1"
                  value={listeningHours}
                  onChange={(event) => setListeningHours(event.target.value)}
                />
              )}
            </Field>
          </div>
        ) : (
          <Field label={t('manualImmersion.totalHours')}>
            {(id) => (
              <input
                id={id}
                className="input w-full"
                type="number"
                min="0"
                max="100000"
                step="0.1"
                value={totalHours}
                onChange={(event) => setTotalHours(event.target.value)}
              />
            )}
          </Field>
        )}

        <Field label={t('manualImmersion.characters')}>
          {(id) => (
            <input
              id={id}
              className="input w-full"
              type="number"
              min="0"
              max="10000000000"
              step="1"
              value={chars}
              onChange={(event) => setChars(event.target.value)}
            />
          )}
        </Field>

        {mutation.isError && (
          <p className="text-sm text-error" role="alert">
            {t('manualImmersion.error')}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-base-content/65">
            {t('manualImmersion.rankingNote')}
          </p>
          <Button
            type="submit"
            variant="primary"
            loading={mutation.isPending}
            disabled={!hasValues}
          >
            {t('manualImmersion.add')}
          </Button>
        </div>
      </form>
    </section>
  );
}
