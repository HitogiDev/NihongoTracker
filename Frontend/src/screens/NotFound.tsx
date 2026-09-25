import { useTranslation } from 'react-i18next';

function NotFound() {
  const { t } = useTranslation('common');

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-base-200">
      <h1 className="text-4xl font-bold mb-4">{t('notFound.title')}</h1>
      <p className="text-lg base-content mb-2">{t('notFound.description')}</p>
      <p className="text-sm base-content">{t('notFound.hint')}</p>
    </div>
  );
}

export default NotFound;
