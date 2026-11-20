import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ILog, IMediaDocument } from '../types';
import useSearch from '../hooks/useSearch';
import { LOG_TYPE_OPTIONS } from '../utils/logTypes';
import DropdownSelect from './ui/DropdownSelect';
import Field from './ui/Field';
import Modal from './ui/Modal';
import RowButton from './ui/RowButton';
import Spinner from './ui/Spinner';

/** Types whose search returns media without a pasted URL. */
const SEARCH_TYPES = new Set<ILog['type']>([
  'anime',
  'manga',
  'light-novel',
  'vn',
  'game',
  'tv show',
  'movie',
  'book',
]);
const SEARCH_TYPE_OPTIONS = LOG_TYPE_OPTIONS.filter(({ value }) =>
  SEARCH_TYPES.has(value)
);

interface StartSessionModalProps {
  open: boolean;
  onClose: () => void;
  recent: IMediaDocument[];
  onPick: (media: IMediaDocument) => void;
}

function MediaRow({
  media,
  onPick,
}: {
  media: IMediaDocument;
  onPick: (media: IMediaDocument) => void;
}) {
  const { t: tCommon } = useTranslation('common');
  const cover = media.coverImage || media.contentImage;
  const blurred = media.type === 'vn' ? media.isAdultImage : media.isAdult;
  const typeKey = LOG_TYPE_OPTIONS.find(({ value }) => value === media.type)?.labelKey;
  return (
    <RowButton onClick={() => onPick(media)} className="px-2">
      {cover ? (
        <img
          src={cover}
          alt=""
          className={`h-12 w-9 shrink-0 rounded-box object-cover ${blurred ? 'blur-xs' : ''}`}
        />
      ) : (
        <span className="h-12 w-9 shrink-0 rounded-box bg-base-300" />
      )}
      <span className="min-w-0">
        <span className="block truncate font-medium">
          {media.title.contentTitleNative}
        </span>
        {typeKey && (
          <span className="block text-xs text-base-content/70">
            {tCommon(typeKey)}
          </span>
        )}
      </span>
    </RowButton>
  );
}

/** Choose the media for a new session timer. */
export default function StartSessionModal({
  open,
  onClose,
  recent,
  onPick,
}: StartSessionModalProps) {
  const { t } = useTranslation('android');
  const { t: tCommon } = useTranslation('common');
  const [type, setType] = useState<ILog['type']>('anime');
  const [query, setQuery] = useState('');
  const { data: results, isFetching } = useSearch(type ?? '', query, undefined, 1, 10, {
    enabled: open,
  });
  const searching = query.trim().length > 0;

  const pick = (media: IMediaDocument) => {
    setQuery('');
    onPick(media);
  };

  return (
    <Modal open={open} onClose={onClose} title={t('sessionTimer.pickTitle')}>
      <div className="space-y-3">
        <Field label={t('sessionTimer.search')}>
          <div className="flex gap-2">
            <DropdownSelect
              className="select w-36 shrink-0"
              value={type ?? ''}
              onChange={(event) => setType(event.target.value as ILog['type'])}
            >
              {SEARCH_TYPE_OPTIONS.map(({ value, labelKey }) => (
                <option key={value} value={value}>
                  {tCommon(labelKey)}
                </option>
              ))}
            </DropdownSelect>
            <input
              type="search"
              className="input min-w-0 flex-1 focus:input-primary"
              placeholder={t('sessionTimer.searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </Field>

        {searching ? (
          <div className="space-y-1">
            {isFetching && !results?.length ? (
              <div className="flex justify-center p-4">
                <Spinner />
              </div>
            ) : results?.length ? (
              results.map((media) => (
                <MediaRow
                  key={`${media.type}:${media.contentId}`}
                  media={media as IMediaDocument}
                  onPick={pick}
                />
              ))
            ) : (
              <p className="p-2 text-sm text-base-content/70">
                {t('sessionTimer.noResults')}
              </p>
            )}
          </div>
        ) : (
          <section className="space-y-1">
            <h4 className="text-sm font-semibold">{t('sessionTimer.recent')}</h4>
            {recent.length ? (
              recent.map((media) => (
                <MediaRow
                  key={`${media.type}:${media.contentId}`}
                  media={media}
                  onPick={pick}
                />
              ))
            ) : (
              <p className="p-2 text-sm text-base-content/70">
                {t('sessionTimer.noRecent')}
              </p>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
