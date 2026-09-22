import { useTranslation } from 'react-i18next';

interface LogPrivacyToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function LogPrivacyToggle({
  checked,
  onChange,
}: LogPrivacyToggleProps) {
  const { t } = useTranslation('logs');

  return (
    <label className="label w-full min-w-0 cursor-pointer items-start justify-start gap-3">
      <input
        type="checkbox"
        className="checkbox shrink-0"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{t('create.privateLog')}</span>
        <span className="whitespace-normal break-words text-base-content/70">
          {t('create.privateLogHint')}
        </span>
      </span>
    </label>
  );
}
