import { useCallback, useEffect, useState } from 'react';
import { CloudOff, ListChecks, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useUserDataStore } from '../store/userData';
import { isNativeApp } from '../utils/nativeRuntime';
import {
  getOfflineOperations,
  offlineQueueEventName,
  removeOfflineOperation,
  updateOfflineOperation,
  type OfflineOperation,
} from '../offline/offlineStore';
import {
  retryOfflineQueue,
  syncOfflineQueue,
  refreshOfflineAccount,
} from '../offline/offlineQueue';
import { prefetchPersonalData } from '../offline/prefetch';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Field from './ui/Field';
import type { ICreateLog } from '../types';

export default function OfflineSyncStatus() {
  const { t } = useTranslation('nav');
  const queryClient = useQueryClient();
  const userId = useUserDataStore((state) => state.user?._id);
  const [operations, setOperations] = useState<OfflineOperation[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OfflineOperation>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const entries = userId ? await getOfflineOperations(userId) : [];
    if (userId === useUserDataStore.getState().user?._id)
      setOperations(entries);
  }, [userId]);

  useEffect(() => {
    if (!isNativeApp()) return;
    setOperations([]);
    setEditing(undefined);
    setOpen(false);
    const run = () => {
      if (document.visibilityState !== 'visible') return;
      void syncOfflineQueue()
        .then(() => prefetchPersonalData())
        .catch(() => undefined);
    };
    const onOnline = () => {
      setOnline(true);
      run();
    };
    const onOffline = () => setOnline(false);
    const onChange = () => {
      void refresh().catch(() => undefined);
    };
    void refresh().catch(() => undefined);
    run();
    const interval = window.setInterval(run, 30000);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener(offlineQueueEventName(), onChange);
    document.addEventListener('visibilitychange', run);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener(offlineQueueEventName(), onChange);
      document.removeEventListener('visibilitychange', run);
    };
  }, [refresh]);

  const perform = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await refreshOfflineAccount();
      await refresh();
      await queryClient.invalidateQueries();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : t('offline.failed'),
      );
    } finally {
      setBusy(false);
    }
  };

  if (!isNativeApp() || !userId) return null;
  const failed = operations.some((operation) => operation.status === 'failed');
  const canChange = (operation: OfflineOperation) =>
    !operation.attempted || operation.status === 'failed';

  return (
    <>
      {(!online || operations.length > 0) && (
        <aside
          className="fixed bottom-24 right-3 z-40 max-w-[calc(100vw-1.5rem)]"
          aria-live="polite"
        >
          <Button size="sm" onClick={() => setOpen(true)}>
            {online ? (
              <ListChecks className="h-4 w-4" />
            ) : (
              <CloudOff className="h-4 w-4" />
            )}
            {t(
              failed
                ? 'offline.attention'
                : online
                  ? 'offline.pendingCount'
                  : 'offline.offlineCount',
              { count: operations.length },
            )}
          </Button>
        </aside>
      )}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(undefined);
        }}
        title={t('offline.title')}
      >
        <p className="text-sm text-base-content/70">
          {t('offline.explanation')}
        </p>
        {error && (
          <p className="text-error mt-3" role="alert">
            {error}
          </p>
        )}
        {operations.length === 0 && (
          <p className="py-6">{t('offline.empty')}</p>
        )}
        <div className="space-y-3 mt-4">
          {operations.map((operation) => (
            <div key={operation.id} className="surface-muted p-3 space-y-2">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">
                  {t(`offline.types.${operation.type}`)}
                </span>
                <span
                  className={
                    operation.status === 'failed'
                      ? 'badge badge-error badge-sm'
                      : 'badge badge-warning badge-sm'
                  }
                >
                  {t(`offline.${operation.status}`)}
                </span>
              </div>
              <p className="text-sm break-words">
                {operation.type === 'log'
                  ? (operation.payload.log as ICreateLog).description
                  : String(
                      operation.payload.username ??
                        operation.payload.clubId ??
                        operation.payload.key ??
                        '',
                    )}
              </p>
              {operation.error && (
                <p className="text-sm text-error">{operation.error}</p>
              )}
              {!canChange(operation) && (
                <p className="text-xs text-base-content/70">
                  {t('offline.confirmFirst')}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {canChange(operation) && operation.type === 'log' && (
                  <Button
                    appearance="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setEditing(operation)}
                  >
                    <Pencil className="h-4 w-4" />
                    {t('offline.edit')}
                  </Button>
                )}
                {canChange(operation) && (
                  <Button
                    variant="error"
                    appearance="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        await removeOfflineOperation(operation);
                        await syncOfflineQueue();
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('offline.discard')}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="modal-action">
          <Link
            to="/settings"
            className="btn btn-ghost btn-sm"
            onClick={() => setOpen(false)}
          >
            {t('links.settings')}
          </Link>
          <Button
            variant="primary"
            size="sm"
            disabled={!online || !operations.length}
            loading={busy}
            onClick={() => void perform(retryOfflineQueue)}
          >
            <RefreshCw className="h-4 w-4" />
            {t('offline.retry')}
          </Button>
        </div>
      </Modal>
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(undefined)}
        title={t('offline.edit')}
      >
        {editing && (
          <form
            key={editing.id}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const log = {
                ...(editing.payload.log as ICreateLog),
                description: String(form.get('description') ?? ''),
              };
              for (const name of [
                'episodes',
                'pages',
                'chars',
                'time',
                'volume',
              ] as const) {
                const value = form.get(name);
                if (value !== null)
                  log[name] = value === '' ? undefined : Number(value);
              }
              void perform(async () => {
                await updateOfflineOperation({
                  ...editing,
                  payload: { ...editing.payload, log },
                  status: 'pending',
                  attempted: false,
                  error: undefined,
                });
                setEditing(undefined);
                await syncOfflineQueue();
              });
            }}
          >
            <Field label={t('offline.description')}>
              {(id) => (
                <textarea
                  id={id}
                  name="description"
                  className="textarea w-full focus:textarea-primary"
                  rows={3}
                  defaultValue={(editing.payload.log as ICreateLog).description}
                />
              )}
            </Field>
            {(['episodes', 'pages', 'chars', 'time', 'volume'] as const)
              .filter(
                (name) =>
                  (editing.payload.log as ICreateLog)[name] !== undefined,
              )
              .map((name) => (
                <Field key={name} label={t(`offline.units.${name}`)}>
                  {(id) => (
                    <input
                      id={id}
                      name={name}
                      type="number"
                      min="0"
                      step={name === 'time' ? 'any' : '1'}
                      required
                      className="input w-full focus:input-primary"
                      defaultValue={(editing.payload.log as ICreateLog)[name]}
                    />
                  )}
                </Field>
              ))}
            <div className="modal-action">
              <Button variant="primary" type="submit" loading={busy}>
                {t('offline.save')}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
