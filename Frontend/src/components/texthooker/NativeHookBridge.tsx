import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, SlidersHorizontal, Target, Unlink, X } from 'lucide-react';
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
  websocket_selected?: boolean;
  hooks: Array<{ selection_key: string; hook_code: string; name: string; sample: string | null }>;
}


export default function NativeHookBridge({ url, contentId, onLine, onSourceChange, websocketStatus, onToggleWebsocket }: {
  url: string;
  contentId: string;
  onLine: (line: NativeLine) => void;
  onSourceChange?: (source: 'lunahook' | 'websocket') => void;
  websocketStatus: string;
  onToggleWebsocket: () => void;
}) {
  const { t } = useTranslation('texthooker');
  const [status, setStatus] = useState<NativeHookStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [source, setSource] = useState<'lunahook' | 'websocket'>('lunahook');
  const [changingSource, setChangingSource] = useState(false);
  const [sourceError, setSourceError] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const onLineRef = useRef(onLine);
  const onSourceChangeRef = useRef(onSourceChange);
  const sourceRef = useRef(source);
  const sourceRequestIdRef = useRef(0);
  const pendingSourceRef = useRef<{ id: number; source: 'lunahook' | 'websocket' } | null>(null);
  const sourceTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const openedPidRef = useRef<number | null>(null);
  const pendingSelectionRef = useRef<string | null>(null);
  const selectionDirtyRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { onLineRef.current = onLine; }, [onLine]);
  useEffect(() => { onSourceChangeRef.current = onSourceChange; }, [onSourceChange]);

  const finishSourceChange = useCallback(() => {
    clearTimeout(sourceTimeoutRef.current);
    pendingSourceRef.current = null;
    setChangingSource(false);
  }, []);

  const changeSource = (nextSource: 'lunahook' | 'websocket') => {
    const socket = socketRef.current;
    if (pendingSourceRef.current || !socket || socket.readyState !== WebSocket.OPEN) return;
    const id = ++sourceRequestIdRef.current;
    pendingSourceRef.current = { id, source: nextSource };
    setSourceError(false);
    setChangingSource(true);
    sourceTimeoutRef.current = setTimeout(() => {
      finishSourceChange();
      setSourceError(true);
    }, 5000);
    try {
      socket.send(JSON.stringify({ type: 'set-source', source: nextSource, requestId: id }));
    } catch {
      finishSourceChange();
      setSourceError(true);
    }
  };

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
          if (sourceRef.current === 'lunahook' && typeof data.line.id === 'string' && typeof data.line.text === 'string' && Number.isFinite(data.line.chars)) onLineRef.current(data.line);
        } else if (data.type === 'native-status' && data.contentId === contentId && Array.isArray(data.hook?.hooks)) {
          setStatus(data.hook);
          const nextSource = data.hook.pid && !data.hook.websocket_selected ? 'lunahook' : 'websocket';
          sourceRef.current = nextSource;
          setSource(nextSource);
          onSourceChangeRef.current?.(nextSource);
          if (pendingSourceRef.current?.source === nextSource) finishSourceChange();
          if (nextSource === 'websocket') setOpen(false);
          if (data.hook.selected_hook_code) {
            if (!selectionDirtyRef.current) setSelection(data.hook.selected_hook_code);
            if (pendingSelectionRef.current === data.hook.selected_hook_code) {
              setSaving(false);
              setOpen(false);
              pendingSelectionRef.current = null;
              selectionDirtyRef.current = false;
            }
          } else if (!data.hook.websocket_selected && data.hook.pid && openedPidRef.current !== data.hook.pid) {
            openedPidRef.current = data.hook.pid;
            setSelection(null);
            selectionDirtyRef.current = false;
            setOpen(true);
          }
        } else if (data.type === 'selection-error') {
          setSaving(false);
          pendingSelectionRef.current = null;
          setError(true);
        } else if (data.type === 'source-changed' && data.contentId === contentId && ['lunahook', 'websocket'].includes(data.source)) {
          const pending = pendingSourceRef.current;
          if (!pending || pending.source !== data.source || (data.requestId != null && data.requestId !== pending.id)) return;
          if (data.hook && Array.isArray(data.hook.hooks)) setStatus(data.hook);
          sourceRef.current = data.source;
          setSource(data.source);
          finishSourceChange();
          setSourceError(false);
          if (data.source === 'websocket') setOpen(false);
          onSourceChangeRef.current?.(data.source);
        } else if (data.type === 'source-error') {
          if (data.requestId != null && data.requestId !== pendingSourceRef.current?.id) return;
          finishSourceChange();
          setSourceError(true);
        }
      };
      socket.onclose = () => {
        setConnected(false);
        setSaving(false);
        finishSourceChange();
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
      sourceRef.current = 'lunahook';
      setSource('lunahook');
      finishSourceChange();
      setSourceError(false);
      openedPidRef.current = null;
    };
  }, [url, contentId, finishSourceChange]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  const active = connected && Boolean(status?.selected_hook_code) && (status?.phase === 'attached' || status?.phase === 'receiving');
  const nativeStatusColor = !connected || status?.phase === 'error' || status?.phase === 'unavailable' ? 'bg-error' : active ? 'bg-success' : 'bg-warning';
  return <>
    <div className="join" role="group" aria-label={t('hooker.native.inputSource')}>
      <button
        type="button"
        className={source === 'websocket' ? 'join-item btn btn-primary btn-sm btn-square relative' : 'join-item btn btn-outline btn-sm btn-square relative'}
        aria-pressed={source === 'websocket'}
        aria-label={t('hooker.native.websocketStatus', { status: websocketStatus })}
        title={t('hooker.native.websocketStatus', { status: websocketStatus })}
        disabled={changingSource || (source !== 'websocket' && !connected)}
        onClick={() => source === 'websocket' ? onToggleWebsocket() : changeSource('websocket')}
      >
        {source === 'websocket' && websocketStatus === 'connected' ? <Link className="h-4 w-4" /> : <Unlink className="h-4 w-4" />}
        {source === 'websocket' && <span aria-hidden="true" className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${websocketStatus === 'connected' ? 'bg-success' : websocketStatus === 'connecting' ? 'bg-warning' : websocketStatus === 'error' ? 'bg-error' : 'bg-base-content/40'}`} />}
      </button>
      <button
        type="button"
        className={source === 'lunahook' ? 'join-item btn btn-primary btn-sm btn-square relative' : 'join-item btn btn-outline btn-sm btn-square relative'}
        aria-pressed={source === 'lunahook'}
        aria-label={t('hooker.native.name')}
        title={t(active ? 'hooker.native.connected' : 'hooker.native.waiting')}
        disabled={!connected || !status?.pid || changingSource}
        onClick={() => source !== 'lunahook' && changeSource('lunahook')}
      >
        <Target className="h-4 w-4" />
        {source === 'lunahook' && <span aria-hidden="true" className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${nativeStatusColor}`} />}
      </button>
    </div>
    {sourceError && <span className="text-error text-xs" role="alert">{t('hooker.native.sourceFailed')}</span>}
    {source === 'lunahook' && <button type="button" className="btn btn-ghost btn-sm btn-square"
      title={t('hooker.native.choose')} aria-label={t('hooker.native.choose')}
      onClick={() => { selectionDirtyRef.current = false; setSelection(status?.selected_hook_code ?? null); setError(false); setOpen(true); }}>
      <SlidersHorizontal className="w-4 h-4" />
    </button>}
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
