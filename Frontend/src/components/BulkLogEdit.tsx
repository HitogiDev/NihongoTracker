import { useEffect, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Pencil } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import type { ILog, IUpdateLogRequest } from '../types';
import { adminUpdateLogsBulkFn, updateLogsBulkFn } from '../api/trackerApi';
import { useUserDataStore } from '../store/userData';
import { useTimezone } from '../hooks/useTimezone';
import { parseDateValue } from '../utils/dateInput';
import { zonedDayTimeToUtc } from '../utils/timezone';
import { LOG_TYPE_OPTIONS } from '../utils/logTypes';
import { getApiErrorMessage } from '../utils/apiError';
import DatePickerInput from './ui/DatePickerInput';
import Field from './ui/Field';
import TagSelector from './TagSelector';

type EditableField = 'description' | 'type' | 'date' | 'time' | 'episodes' | 'volume' | 'pages' | 'chars' | 'tags';
type BulkEditRequest = { ids: string[]; updates: IUpdateLogRequest };

export function BulkLogEditDialog({
  open,
  onClose,
  selectedIds,
  ownerUsername,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  selectedIds: Set<string>;
  ownerUsername?: string;
  onUpdated: () => void;
}) {
  const { t } = useTranslation(['logs', 'common']);
  const { timezone } = useTimezone();
  const { user } = useUserDataStore();
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const [pendingRequest, setPendingRequest] = useState<BulkEditRequest | null>(null);
  const [enabled, setEnabled] = useState<Set<EditableField>>(new Set());
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ILog['type']>('anime');
  const [date, setDate] = useState('');
  const [timeOfDay, setTimeOfDay] = useState('00:00');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [episodes, setEpisodes] = useState('');
  const [volume, setVolume] = useState('');
  const [pages, setPages] = useState('');
  const [chars, setChars] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setEnabled(new Set());
    setDescription('');
    setDate('');
    setTimeOfDay('00:00');
    setHours('');
    setMinutes('');
    setEpisodes('');
    setVolume('');
    setPages('');
    setChars('');
    setTags([]);
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
  }, [open]);

  useEffect(() => {
    if (pendingRequest && confirmRef.current && !confirmRef.current.open) {
      confirmRef.current.showModal();
    }
  }, [pendingRequest]);

  const mutation = useMutation({
    mutationFn: ({ ids, updates }: BulkEditRequest) => {
      const isAdminEdit = user?.roles?.includes('admin') && ownerUsername !== user.username;
      return isAdminEdit
        ? adminUpdateLogsBulkFn(ids, updates)
        : updateLogsBulkFn(ids, updates);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries();
      toast.success(t('bulk.updated', { count: result.updatedCount }));
      setPendingRequest(null);
      onUpdated();
      onClose();
    },
    onError: (error) => {
      setPendingRequest(null);
      toast.error(getApiErrorMessage(error));
    },
  });

  const toggle = (field: EditableField) => {
    setEnabled((previous) => {
      const next = new Set(previous);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const applyField = (field: EditableField, label: string, control: ReactNode) => (
    <div className="surface-muted p-3">
      <label className="flex items-center gap-3 cursor-pointer font-medium">
        <input type="checkbox" className="checkbox checkbox-primary checkbox-sm" checked={enabled.has(field)} onChange={() => toggle(field)} />
        {label}
      </label>
      {enabled.has(field) && <div className="mt-3">{control}</div>}
    </div>
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!enabled.size) {
      toast.error(t('bulk.chooseField'));
      return;
    }
    const updates: IUpdateLogRequest = {};
    if (enabled.has('description')) {
      if (!description.trim()) return void toast.error(t('bulk.invalidValue'));
      updates.description = description;
    }
    if (enabled.has('type')) updates.type = type;
    if (enabled.has('date')) {
      if (!parseDateValue(date) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return void toast.error(t('bulk.invalidValue'));
      }
      updates.date = zonedDayTimeToUtc(date, timeOfDay, timezone);
    }
    if (enabled.has('time')) {
      const hourValue = Number(hours || 0);
      const minuteValue = Number(minutes || 0);
      const total = hourValue * 60 + minuteValue;
      if (!Number.isInteger(hourValue) || hourValue < 0 || hourValue > 24 ||
        !Number.isInteger(minuteValue) || minuteValue < 0 || minuteValue > 59 ||
        total > 1440) {
        return void toast.error(t('bulk.invalidValue'));
      }
      updates.time = total;
    }
    const numeric = { episodes, volume, pages, chars };
    const limits = { episodes: 1000, volume: 10000, pages: 10000, chars: 1000000 };
    for (const field of Object.keys(numeric) as Array<keyof typeof numeric>) {
      if (!enabled.has(field)) continue;
      const value = Number(numeric[field]);
      if (numeric[field] === '' || !Number.isInteger(value) || value < (field === 'volume' ? 1 : 0) || value > limits[field]) {
        return void toast.error(t('bulk.invalidValue'));
      }
      updates[field] = value;
    }
    if (enabled.has('tags')) updates.tags = tags;
    const request = { ids: Array.from(selectedIds), updates };
    if (request.ids.length > 10) setPendingRequest(request);
    else mutation.mutate(request);
  };

  return open ? (
    <>
    <dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle" onCancel={onClose}>
      <div className="modal-box max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold">{t('bulk.title', { count: selectedIds.size })}</h3>
        <p className="text-sm text-base-content/70 mt-1">{t('bulk.onlyChecked')}</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          {applyField('description', t('edit.description'), <Field label={t('edit.description')}><textarea className="textarea w-full" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>)}
          {applyField('type', t('edit.type'), <Field label={t('edit.type')}><select className="select w-full" value={type} onChange={(event) => setType(event.target.value as ILog['type'])}>{LOG_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(`common:${option.labelKey}`)}</option>)}<option value="other">{t('common:mediaTypes.other')}</option></select></Field>)}
          {applyField('date', t('edit.date'), <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label={t('edit.date')}><DatePickerInput value={date} onChange={setDate} ariaLabel={t('edit.date')} /></Field><Field label={t('edit.timeOfDay')}><input type="time" className="input w-full" value={timeOfDay} onChange={(event) => setTimeOfDay(event.target.value)} /></Field></div>)}
          {applyField('time', t('details.timeSpent'), <div className="grid grid-cols-2 gap-3"><Field label={t('edit.hours')}><input type="number" min="0" max="24" className="input w-full" value={hours} onChange={(event) => setHours(event.target.value)} /></Field><Field label={t('edit.minutes')}><input type="number" min="0" max="59" className="input w-full" value={minutes} onChange={(event) => setMinutes(event.target.value)} /></Field></div>)}
          {([
            ['episodes', t('details.episodes'), episodes, setEpisodes],
            ['volume', t('edit.volume'), volume, setVolume],
            ['pages', t('details.pages'), pages, setPages],
            ['chars', t('details.characters'), chars, setChars],
          ] as const).map(([field, label, value, setter]) => <div key={field}>{applyField(field, label, <Field label={label}><input type="number" min={field === 'volume' ? 1 : 0} className="input w-full" value={value} onChange={(event) => setter(event.target.value)} /></Field>)}</div>)}
          {applyField('tags', t('details.tags'), <TagSelector selectedTags={tags} onChange={setTags} label={t('card.tagsLabel')} />)}
          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={mutation.isPending}>{t('common:cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending || selectedIds.size === 0}>{mutation.isPending ? t('edit.updating') : t('bulk.apply', { count: selectedIds.size })}</button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop"><button aria-label={t('common.a11y.closeModal')} onClick={onClose}>close</button></form>
    </dialog>
    {pendingRequest && (
      <dialog
        ref={confirmRef}
        className="modal modal-bottom sm:modal-middle"
        aria-labelledby="bulk-log-confirm-title"
        aria-describedby="bulk-log-confirm-description"
        onCancel={(event) => {
          if (mutation.isPending) event.preventDefault();
          else setPendingRequest(null);
        }}
      >
        <div className="modal-box max-w-md">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-warning/15 p-3 text-warning shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="bulk-log-confirm-title" className="text-lg font-bold">
                {t('bulk.confirmTitle', { count: pendingRequest.ids.length })}
              </h3>
              <p id="bulk-log-confirm-description" className="mt-2 text-sm text-base-content/70">
                {t('bulk.confirmBody', { count: pendingRequest.ids.length })}
              </p>
            </div>
          </div>
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={mutation.isPending}
              onClick={() => setPendingRequest(null)}
            >
              {t('common:cancel')}
            </button>
            <button
              type="button"
              className="btn btn-warning"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(pendingRequest)}
            >
              {mutation.isPending
                ? t('edit.updating')
                : t('bulk.confirmApply', { count: pendingRequest.ids.length })}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button
            aria-label={t('common.a11y.closeModal')}
            disabled={mutation.isPending}
            onClick={() => setPendingRequest(null)}
          >
            close
          </button>
        </form>
      </dialog>
    )}
    </>
  ) : null;
}

export function BulkLogToolbar({
  shownIds,
  loadAllIds,
  selectedIds,
  setSelectedIds,
  ownerUsername,
  scopeKey,
}: {
  shownIds: string[];
  loadAllIds: () => Promise<string[]>;
  selectedIds: Set<string>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  ownerUsername?: string;
  scopeKey: string;
}) {
  const { t } = useTranslation('logs');
  const [loadingAll, setLoadingAll] = useState(false);
  const [editing, setEditing] = useState(false);
  const currentScope = useRef(scopeKey);

  useEffect(() => {
    currentScope.current = scopeKey;
    setSelectedIds(new Set());
  }, [scopeKey, setSelectedIds]);

  const selectAll = async () => {
    const requestedScope = currentScope.current;
    setLoadingAll(true);
    try {
      const ids = await loadAllIds();
      if (currentScope.current === requestedScope) setSelectedIds(new Set(ids));
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setLoadingAll(false);
    }
  };

  return (
    <>
      {selectedIds.size > 0 && (
        <div className="surface-muted space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t('bulk.selectionTitle')}</p>
              <p className="text-sm text-base-content/70">
                {t('bulk.selected', { count: selectedIds.size })}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedIds(new Set())}
            >
              {t('bulk.clear')}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={!shownIds.length}
                onClick={() => setSelectedIds(new Set(shownIds))}
              >
                {t('bulk.selectShown')}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={loadingAll}
                onClick={() => void selectAll()}
              >
                {loadingAll ? t('bulk.selecting') : t('bulk.selectAll')}
              </button>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setEditing(true)}
            >
              <Pencil className="w-4 h-4" />
              {t('bulk.edit')}
            </button>
          </div>
        </div>
      )}
      <BulkLogEditDialog open={editing} onClose={() => setEditing(false)} selectedIds={selectedIds} ownerUsername={ownerUsername} onUpdated={() => setSelectedIds(new Set())} />
    </>
  );
}

export function SelectableLogRow({
  ids,
  selectedIds,
  setSelectedIds,
  children,
}: {
  ids: string[];
  selectedIds: Set<string>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  children: ReactNode;
}) {
  const { t } = useTranslation('logs');
  const selected = ids.every((id) => selectedIds.has(id));
  return (
    <div className="flex items-start gap-2">
      <label className="pt-4 cursor-pointer">
        <input
          type="checkbox"
          className="checkbox checkbox-primary checkbox-sm"
          aria-label={t('bulk.selectEntry')}
          checked={selected}
          onChange={() => setSelectedIds((previous) => {
            const next = new Set(previous);
            ids.forEach((id) => selected ? next.delete(id) : next.add(id));
            return next;
          })}
        />
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
