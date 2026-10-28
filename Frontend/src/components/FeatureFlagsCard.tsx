import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { IFeatureFlags, updateFeatureFlagFn } from '../api/trackerApi';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

const FLAGS = [
  {
    key: 'wrapped',
    label: 'features.wrapped.label',
    description: 'features.wrapped.description',
  },
] as const;

export default function FeatureFlagsCard() {
  const { t } = useTranslation('admin');
  const queryClient = useQueryClient();
  const flags = useFeatureFlags();
  const update = useMutation({
    mutationFn: ({
      key,
      enabled,
    }: {
      key: keyof IFeatureFlags;
      enabled: boolean;
    }) => updateFeatureFlagFn(key, enabled),
    onSuccess: (data) => {
      queryClient.setQueryData(['featureFlags'], data);
      toast.success(t('features.saved'));
    },
  });

  return (
    <div className="card surface">
      <div className="card-body">
        <h3 className="card-title">{t('features.title')}</h3>
        <p className="text-sm text-base-content/70">
          {t('features.description')}
        </p>
        <ul className="mt-2 flex flex-col gap-3">
          {FLAGS.map((flag) => (
            <li key={flag.key}>
              <label className="flex cursor-pointer items-start justify-between gap-4">
                <span>
                  <span className="block font-medium">{t(flag.label)}</span>
                  <span className="block text-sm text-base-content/60">
                    {t(flag.description)}
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={flags[flag.key]}
                  disabled={update.isPending}
                  onChange={(event) =>
                    update.mutate({
                      key: flag.key,
                      enabled: event.target.checked,
                    })
                  }
                />
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
