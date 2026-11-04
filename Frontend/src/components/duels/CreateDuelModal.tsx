import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { createDuelFn } from '../../api/duelsApi';
import type { DuelMetric, GoalMediaType } from '../../types';
import { getApiErrorMessage } from '../../utils/apiError';
import { DUEL_DURATIONS, DUEL_METRICS } from '../../utils/duels';
import { goalMediaTypeKey, goalMediaTypes } from '../../utils/goalMediaTypes';
import Button from '../ui/Button';
import DropdownSelect from '../ui/DropdownSelect';
import Field from '../ui/Field';
import Modal from '../ui/Modal';
import UserPicker, { type PickedUser } from './UserPicker';

interface CreateDuelModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fills the opponent, such as when opened from a profile. */
  opponent?: PickedUser;
}

const METRIC_LABEL_KEYS = {
  time: 'goals:types.timeMinutes',
  chars: 'goals:types.chars',
  pages: 'goals:types.pages',
  episodes: 'goals:types.episodes',
} as const;

export default function CreateDuelModal({
  open,
  onClose,
  opponent: initialOpponent,
}: CreateDuelModalProps) {
  const { t } = useTranslation(['duels', 'goals', 'common']);
  const queryClient = useQueryClient();
  const [opponent, setOpponent] = useState<PickedUser | null>(
    initialOpponent ?? null
  );
  const [metric, setMetric] = useState<DuelMetric>('episodes');
  const [target, setTarget] = useState('10');
  const [mediaType, setMediaType] = useState<GoalMediaType | ''>('anime');
  const [durationDays, setDurationDays] = useState('7');
  const [error, setError] = useState<string | null>(null);
  const initialUsername = initialOpponent?.username;

  useEffect(() => {
    if (open) {
      setOpponent(
        initialUsername ? { username: initialUsername } : null
      );
      setError(null);
    }
  }, [open, initialUsername]);

  const mutation = useMutation({
    mutationFn: createDuelFn,
    onSuccess: () => {
      toast.success(t('toasts.sent'));
      queryClient.invalidateQueries({ queryKey: ['duels'] });
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const submit = () => {
    const parsedTarget = Number(target);
    if (!opponent) return setError(t('validation.opponent'));
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      return setError(t('validation.target'));
    }
    const parsedDuration = Number(durationDays);
    if (
      !Number.isInteger(parsedDuration) ||
      parsedDuration < 1 ||
      parsedDuration > 90
    ) {
      return setError(t('validation.duration'));
    }
    setError(null);
    return mutation.mutate({
      opponentUsername: opponent.username,
      metric,
      target: parsedTarget,
      mediaType: mediaType || null,
      durationDays: parsedDuration,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('modal.title')}
      actions={
        <>
          <Button appearance="ghost" onClick={onClose}>
            {t('common:cancel')}
          </Button>
          <Button variant="primary" loading={mutation.isPending} onClick={submit}>
            {t('modal.submit')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label={t('modal.opponent')} required error={error ?? undefined}>
          {(id) => (
            <UserPicker id={id} value={opponent} onChange={setOpponent} />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('modal.metric')}>
            <DropdownSelect
              className="select w-full"
              value={metric}
              onChange={(event) => setMetric(event.target.value as DuelMetric)}
            >
              {DUEL_METRICS.map((option) => (
                <option key={option} value={option}>
                  {t(METRIC_LABEL_KEYS[option])}
                </option>
              ))}
            </DropdownSelect>
          </Field>
          <Field label={t('modal.target')}>
            {(id) => (
              <input
                id={id}
                type="number"
                min={1}
                className="input w-full focus:input-primary"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              />
            )}
          </Field>
        </div>
        <Field label={t('modal.mediaType')}>
          <DropdownSelect
            className="select w-full"
            value={mediaType}
            onChange={(event) =>
              setMediaType(event.target.value as GoalMediaType | '')
            }
          >
            <option value="">{t('modal.anyMedia')}</option>
            {goalMediaTypes.map((type) => (
              <option key={type} value={type}>
                {t(`common:mediaTypes.${goalMediaTypeKey(type)}`)}
              </option>
            ))}
          </DropdownSelect>
        </Field>
        <Field label={t('modal.duration')} hint={t('modal.durationHint')}>
          <DropdownSelect
            className="select w-full"
            value={durationDays}
            onChange={(event) => setDurationDays(event.target.value)}
          >
            {DUEL_DURATIONS.map((days) => (
              <option key={days} value={String(days)}>
                {t('modal.days', { count: days })}
              </option>
            ))}
          </DropdownSelect>
        </Field>
      </div>
    </Modal>
  );
}
