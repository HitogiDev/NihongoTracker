import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IMediaList } from '../types';

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
    <div className="modal modal-open">
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
          <div className="form-control">
            <label className="label" htmlFor="media-list-title">
              <span className="label-text">{t('lists.form.title')}</span>
              <span className="label-text-alt">
                {values.title.length}/{TITLE_MAX_LENGTH}
              </span>
            </label>
            <input
              id="media-list-title"
              className="input input-bordered w-full"
              value={values.title}
              maxLength={TITLE_MAX_LENGTH}
              placeholder={t('lists.form.titlePlaceholder')}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, title: e.target.value }))
              }
            />
          </div>

          <div className="form-control">
            <label className="label" htmlFor="media-list-description">
              <span className="label-text">{t('lists.form.description')}</span>
              <span className="label-text-alt">
                {values.description.length}/{DESCRIPTION_MAX_LENGTH}
              </span>
            </label>
            <textarea
              id="media-list-description"
              className="textarea textarea-bordered w-full h-28"
              value={values.description}
              maxLength={DESCRIPTION_MAX_LENGTH}
              placeholder={t('lists.form.descriptionPlaceholder')}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, description: e.target.value }))
              }
            />
          </div>

          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={values.isRanked}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, isRanked: e.target.checked }))
              }
            />
            <span className="label-text">{t('lists.form.ranked')}</span>
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
            <span className="label-text">{t('lists.form.public')}</span>
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
      <div className="modal-backdrop bg-black/40" onClick={onClose} />
    </div>
  );
}

export default MediaListFormModal;
