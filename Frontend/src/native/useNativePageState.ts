import { useEffect, useState, type SetStateAction } from "react";
import { useUserDataStore } from "../store/userData";
import { isMobileApp } from "../utils/nativeRuntime";

export function useNativePageState<T>(key: string, initial: T | (() => T)) {
  const account = useUserDataStore((state) => state.user?._id ?? "guest");
  const storageKey = `nihongo:native:${account}:${key}`;
  const [value, setValue] = useState<T>(() => {
    if (isMobileApp()) {
      try {
        const saved = sessionStorage.getItem(storageKey);
        if (saved !== null) return JSON.parse(saved) as T;
      } catch {
        /* Use the screen defaults when storage is unavailable. */
      }
    }
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });
  useEffect(() => {
    if (!isMobileApp()) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* Keep state in memory. */
    }
  }, [storageKey, value]);
  return [value, setValue] as [T, (next: SetStateAction<T>) => void];
}
