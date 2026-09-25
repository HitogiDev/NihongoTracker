import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IMediaList } from '../types';
import Field from './ui/Field';

export interface MediaListFormValues {
  title: string;
  description: string;
  isRanked: boolean;
  isPublic: boolean;
}

interface MediaListFormModalProps {
  open: boolean;
  list?: IMediaList | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: MediaListFormValues) => void;
}

const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 2000;

function MediaListFormModal({
  open,
  list,
  isSubmitting = false,
  onClose,
  onSubmit,
}: MediaListFormModalProps) {
  const { t } = useTranslation('media');
  const [values, setValues] = useState<MediaListFormValues>({
    title: '',
    description: '',
    isRanked: false,
    isPublic: true,
  });

  useEffect(() => {
    if (!open) return;
    setValues({
      title: list?.title ?? '',
      description: list?.description ?? '',
      isRanked: list?.isRanked ?? false,
      isPublic: list?.isPublic ?? true,
    });
  }, [open, list]);

  if (!open) return null;

  const trimmedTitle = values.title.trim();

  return (
    <div className="modal modal-bottom sm:modal-middle modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">
          {list ? t('lists.form.editTitle') : t('lists.form.createTitle')}
        </h3>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!trimmedTitle) return;
            onSubmit({ ...values, title: trimmedTitle });
          }}
          className="flex flex-col gap-4"
        >
          <Field
            label={t('lists.form.title')}
            aside={`${values.title.length}/${TITLE_MAX_LENGTH}`}
          >
            <input
              id="media-list-title"
              className="input w-full"
              value={values.title}
              maxLength={TITLE_MAX_LENGTH}
              placeholder={t('lists.form.titlePlaceholder')}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, title: e.target.value }))
              }
            />
          </Field>

          <Field
            label={t('lists.form.description')}
            aside={`${values.description.length}/${DESCRIPTION_MAX_LENGTH}`}
          >
            <textarea
              id="media-list-description"
              className="textarea w-full"
              rows={4}
              value={values.description}
              maxLength={DESCRIPTION_MAX_LENGTH}
              placeholder={t('lists.form.descriptionPlaceholder')}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, description: e.target.value }))
              }
            />
          </Field>

          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={values.isRanked}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, isRanked: e.target.checked }))
              }
            />
            <span>{t('lists.form.ranked')}</span>
          </label>

          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={values.isPublic}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, isPublic: e.target.checked }))
              }
            />
            <span>{t('lists.form.public')}</span>
          </label>

          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {t('lists.form.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!trimmedTitle || isSubmitting}
            >
              {isSubmitting && (
                <span className="loading loading-spinner loading-xs" />
              )}
              {list ? t('lists.form.save') : t('lists.form.create')}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}

export default MediaListFormModal;
