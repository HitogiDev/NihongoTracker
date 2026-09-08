import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { useTranslation } from 'react-i18next';
import {
  createImmersionForecastFn,
  multiSearchMediaFn,
  updateImmersionForecastFn,
} from '../api/trackerApi';
import {
  IImmersionForecast,
  IMediaDocument,
  SearchResultType,
} from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { useUserDataStore } from '../store/userData';
import { getApiErrorMessage } from '../utils/apiError';
import Modal from './ui/Modal';
import Field from './ui/Field';
import Button from './ui/Button';
import RowButton from './ui/RowButton';
import { buttonClass } from './ui/buttons';

type InitialMedia = Pick<
  IMediaDocument,
  'contentId' | 'type' | 'title' | 'contentImage' | 'isAdult'
>;

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function parseDateInput(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function DayPickerChevron({
  orientation,
}: {
  orientation?: 'left' | 'right' | 'up' | 'down';
}) {
  const iconClass = 'w-4 h-4 text-base-content/60';
  return orientation === 'left' ? (
    <ChevronLeft className={iconClass} />
  ) : (
    <ChevronRight className={iconClass} />
  );
}

function displayTitle(media: Pick<IMediaDocument, 'title'>): string {
  return (
    media.title.contentTitleNative ||
    media.title.contentTitleRomaji ||
    media.title.contentTitleEnglish ||
    ''
  );
}

const CALENDAR_WIDTH = 288;
const CALENDAR_HEIGHT = 304;

function getCalendarPosition(button: HTMLButtonElement) {
  const bounds = button.getBoundingClientRect();
  const gap = 4;
  const top =
    bounds.top >= CALENDAR_HEIGHT + gap
      ? bounds.top - CALENDAR_HEIGHT - gap
      : bounds.bottom + gap;
  const left = Math.min(
    Math.max(8, bounds.right - CALENDAR_WIDTH),
    window.innerWidth - CALENDAR_WIDTH - 8
  );
  return { top, left };
}

export default function ForecastModal({
  open,
  onClose,
  initialMedia,
  forecast,
}: {
  open: boolean;
  onClose: () => void;
  initialMedia?: InitialMedia;
  forecast?: IImmersionForecast;
}) {
  const { t } = useTranslation('goals');
  const { user } = useUserDataStore();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultType[]>([]);
  const [selected, setSelected] = useState<InitialMedia | null>(null);
  const [targetDate, setTargetDate] = useState(tomorrow());
  const [searching, setSearching] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarPosition, setCalendarPosition] = useState({ top: 0, left: 0 });
  const [calendarPortalHost, setCalendarPortalHost] =
    useState<HTMLDialogElement | null>(null);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const debouncedQuery = useDebounce(query, 300);
  const tier = user?.patreon?.tier;
  const canManage = Boolean(
    user?.roles?.includes('admin') ||
      (user?.patreon?.isActive &&
        (tier === 'enthusiast' || tier === 'consumer'))
  );

  useEffect(() => {
    if (!open) return;
    setSelected(initialMedia ?? null);
    setQuery('');
    setResults([]);
    setIsCalendarOpen(false);
    setTargetDate(forecast?.targetDate.slice(0, 10) ?? tomorrow());
  }, [forecast, initialMedia, open]);

  useLayoutEffect(() => {
    if (!isCalendarOpen || !calendarButtonRef.current) return;
    const updatePosition = () => {
      if (calendarButtonRef.current) {
        setCalendarPosition(getCalendarPosition(calendarButtonRef.current));
      }
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isCalendarOpen]);

  useLayoutEffect(() => {
    if (!isCalendarOpen) {
      setCalendarPortalHost(null);
      return;
    }
    const activeDialog = Array.from(
      document.querySelectorAll<HTMLDialogElement>('dialog')
    ).find((dialog) => dialog.open);
    setCalendarPortalHost(activeDialog ?? null);
  }, [isCalendarOpen]);

  useEffect(() => {
    if (!open || selected || debouncedQuery.trim().length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setSearching(true);
    multiSearchMediaFn({ search: debouncedQuery.trim(), perPage: 12 })
      .then((items) => {
        if (active) setResults(items.filter((item) => item.type !== 'video'));
      })
      .catch(() => {
        if (active) setResults([]);
      })
      .finally(() => {
        if (active) setSearching(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedQuery, open, selected]);

  const mutation = useMutation({
    mutationFn: () => {
      if (forecast) {
        return updateImmersionForecastFn(forecast._id, targetDate);
      }
      if (!selected) throw new Error(t('forecast.selectRequired'));
      return createImmersionForecastFn({
        mediaId: selected.contentId,
        mediaType: selected.type,
        targetDate,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['immersionForecasts'] });
      onClose();
    },
  });

  const actions = canManage ? (
    <>
      <Button appearance="ghost" onClick={onClose}>
        {t('modal.cancel')}
      </Button>
      <Button
        variant="primary"
        loading={mutation.isPending}
        disabled={(!forecast && !selected) || !targetDate}
        onClick={() => mutation.mutate()}
      >
        {forecast ? t('modal.saveChanges') : t('forecast.create')}
      </Button>
    </>
  ) : undefined;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={forecast ? t('forecast.editTitle') : t('forecast.createTitle')}
      actions={actions}
      size="lg"
    >
      {!canManage ? (
        <div role="alert" className="alert alert-info alert-vertical">
          <div>
            <p className="font-semibold">{t('forecast.lockedTitle')}</p>
            <p className="text-sm">{t('forecast.lockedBody')}</p>
          </div>
          <Link
            to="/support"
            className={buttonClass({ variant: 'primary', size: 'sm' })}
            onClick={onClose}
          >
            {t('forecast.upgrade')}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {!forecast && !selected && (
            <Field label={t('forecast.media')}>
              {(id) => (
                <label className="input w-full" htmlFor={id}>
                  <Search className="w-4 h-4 opacity-50" />
                  <input
                    id={id}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('forecast.searchPlaceholder')}
                  />
                </label>
              )}
            </Field>
          )}

          {!forecast && !selected && query.trim().length >= 2 && (
            <div className="surface-muted max-h-64 overflow-y-auto p-1">
              {searching ? (
                <p className="p-4 text-sm text-base-content/60">
                  {t('forecast.searching')}
                </p>
              ) : results.length ? (
                results.map((media) => (
                  <RowButton
                    key={`${media.type}:${media.contentId}`}
                    onClick={() => setSelected(media)}
                  >
                    {media.contentImage ? (
                      <img
                        src={media.contentImage}
                        alt=""
                        className="w-10 h-14 object-cover rounded-field"
                      />
                    ) : (
                      <div className="w-10 h-14 bg-base-300 rounded-field" />
                    )}
                    <span className="min-w-0">
                      <span className="block font-medium truncate">
                        {displayTitle(media)}
                      </span>
                      <span className="block text-xs opacity-60">
                        {media.type}
                      </span>
                    </span>
                  </RowButton>
                ))
              ) : (
                <p className="p-4 text-sm text-base-content/60">
                  {t('forecast.noResults')}
                </p>
              )}
            </div>
          )}

          {(selected || forecast) && (
            <div className="surface-muted flex items-center gap-3 p-3">
              {selected?.contentImage || forecast?.mediaImage ? (
                <img
                  src={selected?.contentImage || forecast?.mediaImage}
                  alt=""
                  className="w-12 h-16 object-cover rounded-field"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">
                  {selected ? displayTitle(selected) : forecast?.mediaTitle}
                </p>
                <p className="text-xs text-base-content/60">
                  {selected?.type || forecast?.mediaType}
                </p>
              </div>
              {!initialMedia && !forecast && (
                <Button size="sm" appearance="ghost" onClick={() => setSelected(null)}>
                  {t('forecast.change')}
                </Button>
              )}
            </div>
          )}

          {(selected || forecast) && (
            <Field label={t('forecast.targetDate')} required>
              {(id) => (
                <>
                  <button
                    id={id}
                    ref={calendarButtonRef}
                    type="button"
                    className="input focus:input-primary w-full flex items-center justify-between cursor-pointer"
                    aria-expanded={isCalendarOpen}
                    aria-label={t('forecast.targetDate')}
                    onClick={() => setIsCalendarOpen((openState) => !openState)}
                  >
                    <span>{parseDateInput(targetDate).toLocaleDateString()}</span>
                    <Calendar className="w-4 h-4" />
                  </button>
                  {isCalendarOpen &&
                    createPortal(
                      <div
                        className="card card-sm surface-raised fixed z-[2000] w-72 p-2"
                        style={calendarPosition}
                      >
                        <DayPicker
                          className="rdp-themed"
                          mode="single"
                          selected={parseDateInput(targetDate)}
                          onSelect={(date) => {
                            setTargetDate(
                              formatDateInput(date || parseDateInput(targetDate))
                            );
                            setIsCalendarOpen(false);
                            calendarButtonRef.current?.focus();
                          }}
                          disabled={{ before: parseDateInput(tomorrow()) }}
                          components={{ Chevron: DayPickerChevron }}
                        />
                      </div>,
                      calendarPortalHost ?? document.body
                    )}
                </>
              )}
            </Field>
          )}

          {mutation.isError && (
            <div role="alert" className="alert alert-error">
              <span>{getApiErrorMessage(mutation.error)}</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
