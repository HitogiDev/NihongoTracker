import { createContext, useContext, useEffect } from "react";

export const NativeDirtyContext = createContext<{
  setDirty: (value: boolean) => void;
  clearDirty: () => void;
} | null>(null);

export function useNativeUnsavedChanges(dirty: boolean, enabled = true) {
  const context = useContext(NativeDirtyContext);
  const setDirty = context?.setDirty;
  useEffect(() => {
    if (!enabled) return;
    setDirty?.(dirty);
    return () => setDirty?.(false);
  }, [dirty, enabled, setDirty]);
  return context?.clearDirty ?? (() => undefined);
}
