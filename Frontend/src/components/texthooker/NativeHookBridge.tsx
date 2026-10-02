import { useEffect, useRef, useState } from 'react';
import { Target, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface NativeLine {
  id: string;
  content_id: string;
  text: string;
  chars: number;
  created_at: string;
}

interface NativeHookStatus {
  phase: string;
  pid: number | null;
  selected_hook_code: string | null;
  hooks: Array<{ selection_key: string; hook_code: string; name: string; sample: string | null }>;
}


export default function NativeHookBridge({ url, contentId, onLine }: {
  url: string;
  contentId: string;
  onLine: (line: NativeLine) => void;
}) {
  const { t } = useTranslation('texthooker');
  const [status, setStatus] = useState<NativeHookStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const onLineRef = useRef(onLine);
  const openedPidRef = useRef<number | null>(null);
  const pendingSelectionRef = useRef<string | null>(null);
  const selectionDirtyRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { onLineRef.current = onLine; }, [onLine]);

  useEffect(() => {
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      if (disposed) return;
      let socket: WebSocket;
      try { socket = new WebSocket(url); } catch {
        setConnected(false);
        retry = setTimeout(connect, 3000);
        return;
      }
      socketRef.current = socket;
      socket.onopen = () => setConnected(true);
      socket.onmessage = (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === 'native-line' && data.contentId === contentId && data.line?.content_id === contentId) {
          if (typeof data.line.id === 'string' && typeof data.line.text === 'string' && Number.isFinite(data.line.chars)) onLineRef.current(data.line);
        } else if (data.type === 'native-status' && data.contentId === contentId && Array.isArray(data.hook?.hooks)) {
          setStatus(data.hook);
          if (data.hook.selected_hook_code) {
            if (!selectionDirtyRef.current) setSelection(data.hook.selected_hook_code);
            if (pendingSelectionRef.current === data.hook.selected_hook_code) {
              setSaving(false);
              setOpen(false);
              pendingSelectionRef.current = null;
              selectionDirtyRef.current = false;
            }
          } else if (data.hook.pid && openedPidRef.current !== data.hook.pid) {
            openedPidRef.current = data.hook.pid;
            setSelection(null);
            selectionDirtyRef.current = false;
            setOpen(true);
          }
        } else if (data.type === 'selection-error') {
          setSaving(false);
          pendingSelectionRef.current = null;
          setError(true);
        }
      };
      socket.onclose = () => {
        setConnected(false);
        setSaving(false);
        pendingSelectionRef.current = null;
        if (!disposed) retry = setTimeout(connect, 3000);
      };
      socket.onerror = () => socket.close();
    };
    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket) { socket.onclose = null; socket.onmessage = null; socket.onerror = null; socket.close(); }
      setStatus(null);
      setConnected(false);
      setOpen(false);
      setSelection(null);
      setSaving(false);
      setError(false);
      pendingSelectionRef.current = null;
      selectionDirtyRef.current = false;
      openedPidRef.current = null;
    };
  }, [url, contentId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  const active = connected && (status?.phase === 'attached' || status?.phase === 'receiving');
  return <>
    <button type="button" className={`btn btn-ghost btn-xs ${active ? 'text-success' : 'text-warning'}`}
      title={t(active ? 'hooker.native.connected' : 'hooker.native.waiting')}
      onClick={() => { selectionDirtyRef.current = false; setSelection(status?.selected_hook_code ?? null); setError(false); setOpen(true); }}>
      <Target className="w-4 h-4" /> {t('hooker.native.name')}
    </button>
    <dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle" onClose={() => { selectionDirtyRef.current = false; setOpen(false); }}>
      <div className="modal-box max-w-2xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-lg">{t('hooker.native.choose')}</h3>
          <button type="button" className="btn btn-ghost btn-sm btn-circle" aria-label={t('hooker.native.close')} onClick={() => setOpen(false)}><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-base-content/70 mb-4">{t('hooker.native.description')}</p>
        {!status?.hooks.length && <p className="surface-muted p-3 text-sm">{t('hooker.native.waiting')}</p>}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {status?.hooks.map((hook) => <label key={hook.selection_key} className="surface-muted flex items-start gap-3 p-3 cursor-pointer">
            <input type="radio" name="native-hook" className="radio radio-primary radio-sm mt-1" checked={selection === hook.selection_key} onChange={() => { selectionDirtyRef.current = true; setSelection(hook.selection_key); }} />
            <span className="min-w-0 flex-1"><span className="block font-medium">{hook.name || hook.hook_code}</span><span className="block break-words text-sm text-base-content/70">{hook.sample}</span><code className="block truncate text-xs text-base-content/50">{hook.hook_code}</code></span>
          </label>)}
        </div>
        {error && <p className="text-error text-sm mt-3">{t('hooker.native.saveFailed')}</p>}
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>{t('hooker.native.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={!connected || !selection || saving || !status?.hooks.some((hook) => hook.selection_key === selection)} onClick={() => {
            setError(false); setSaving(true); pendingSelectionRef.current = selection;
            socketRef.current?.send(JSON.stringify({ type: 'select-hook', selectionKey: selection }));
          }}>{t('hooker.native.save')}</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button aria-label={t('hooker.native.close')}>{t('hooker.native.close')}</button></form>
    </dialog>
  </>;
}
