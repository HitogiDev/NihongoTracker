import DropdownSelect from '../ui/DropdownSelect';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { updateSocialPrivacyFn } from '../../api/trackerApi';
import { useUserDataStore } from '../../store/userData';
import type {
  CommentPermission,
  ISocialPrivacySettings,
  SocialVisibility,
} from '../../types';
import { getApiErrorMessage } from '../../utils/apiError';
import Spinner from '../ui/Spinner';

type PrivacyKey =
  | 'profile'
  | 'immersionActivity'
  | 'statistics'
  | 'commenting';

const DEFAULTS: ISocialPrivacySettings = {
  profile: 'public',
  immersionActivity: 'public',
  statistics: 'public',
  commenting: 'everyone',
};

const FIELDS: PrivacyKey[] = [
  'profile',
  'immersionActivity',
  'statistics',
  'commenting',
];

const SOCIAL_VISIBILITIES: SocialVisibility[] = [
  'public',
  'followers',
  'following',
  'private',
];

const COMMENT_PERMISSIONS: CommentPermission[] = [
  'everyone',
  'followers',
  'following',
  'nobody',
];

export default function SocialPrivacySettings() {
  const { t } = useTranslation('settings');
  const { user, setUser } = useUserDataStore();
  const [privacy, setPrivacy] = useState<ISocialPrivacySettings>({
    ...DEFAULTS,
    ...user?.settings?.socialPrivacy,
  });

  useEffect(() => {
    setPrivacy({ ...DEFAULTS, ...user?.settings?.socialPrivacy });
  }, [user?.settings?.socialPrivacy]);

  const mutation = useMutation({
    mutationFn: updateSocialPrivacyFn,
    onSuccess: ({ socialPrivacy }) => {
      if (user) {
        setUser({
          ...user,
          settings: {
            ...user.settings,
            blurAdultContent: user.settings?.blurAdultContent ?? false,
            socialPrivacy,
          },
        });
      }
      toast.success(t('privacy.saved'));
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(privacy);
      }}
    >
      {FIELDS.map((field) => (
        <fieldset key={field} className="fieldset w-full p-0">
          <legend className="fieldset-legend font-medium">
            {t(`privacy.fields.${field}.label`)}
          </legend>
          <p className="mb-2 text-sm text-base-content/60">
            {t(`privacy.fields.${field}.help`)}
          </p>
          <DropdownSelect
            className="select focus:select-primary w-full max-w-md"
            value={privacy[field]}
            disabled={mutation.isPending}
            onChange={(event) =>
              setPrivacy((current) => ({
                ...current,
                [field]: event.target.value as ISocialPrivacySettings[PrivacyKey],
              }))
            }
          >
            {field === 'commenting'
              ? COMMENT_PERMISSIONS.map((permission) => (
                  <option key={permission} value={permission}>
                    {t(`privacy.commenting.${permission}`)}
                  </option>
                ))
              : SOCIAL_VISIBILITIES.map((visibility) => (
                  <option key={visibility} value={visibility}>
                    {t(`privacy.visibility.${visibility}`)}
                  </option>
                ))}
          </DropdownSelect>
        </fieldset>
      ))}

      <div className="card-actions justify-end">
        <button className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner size="sm" />}
          {t('privacy.save')}
        </button>
      </div>
    </form>
  );
}
