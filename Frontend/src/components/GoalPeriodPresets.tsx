import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Field from './ui/Field';
import {
  goalPeriodFromPreset,
  type GoalPeriod,
  type GoalPeriodPreset
} from '../utils/goalPeriod';

interface GoalPeriodPresetsProps {
  timeZone: string;
  onSelect: (period: GoalPeriod) => void;
}

export default function GoalPeriodPresets({
  timeZone,
  onSelect
}: GoalPeriodPresetsProps) {
  const { t } = useTranslation('goals');
  const [days, setDays] = useState('7');
  const dayCount = Number(days);
  const validDays = /^\d+$/.test(days) && dayCount >= 1 && dayCount <= 3650;

  const selectPreset = (preset: GoalPeriodPreset) => {
    onSelect(goalPeriodFromPreset(preset, timeZone, dayCount));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t('modal.quickPeriods')}</p>
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
        <button
          type="button"
          className="btn btn-outline btn-sm w-full"
          onClick={() => selectPreset('today')}
        >
          {t('modal.today')}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm w-full"
          onClick={() => selectPreset('thisWeek')}
        >
          {t('modal.thisWeek')}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm w-full"
          onClick={() => selectPreset('thisMonth')}
        >
          {t('modal.thisMonth')}
        </button>
      </div>
      <Field label={t('modal.days')}>
        {(id) => (
          <div className="join flex w-full">
            <input
              id={id}
              type="text"
              inputMode="numeric"
              className="input input-sm join-item w-24 shrink-0"
              value={days}
              onChange={(event) => setDays(event.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline btn-sm join-item min-w-0 flex-1"
              disabled={!validDays}
              onClick={() => selectPreset('nextDays')}
            >
              {t('modal.nextDays', { count: validDays ? dayCount : 7 })}
            </button>
          </div>
        )}
      </Field>
    </div>
  );
}
