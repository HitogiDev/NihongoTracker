import { useEffect, useState } from 'react';
import { useUserDataStore } from '../store/userData';
import { isNativeApp } from '../utils/nativeRuntime';
import { cachedImage, cacheImage, mobileImageUrl } from '../offline/imageCache';

export function useOfflineImage(src?: string) {
  const userId = useUserDataStore((state) => state.user?._id);
  const [cached, setCached] = useState<{
    src: string;
    userId: string;
    url: string;
  }>();
  const [resolved, setResolved] = useState<string>();
  const native = isNativeApp();
  useEffect(() => {
    if (!native || !userId || !src) return;
    let active = true;
    let objectUrl: string | undefined;
    void (async () => {
      const blob =
        (await cachedImage(userId, src).catch(() => null)) ??
        (navigator.onLine ? await cacheImage(userId, src) : null);
      if (active && blob) {
        objectUrl = URL.createObjectURL(blob);
        setCached({ src, userId, url: objectUrl });
      }
      if (active) setResolved(`${userId}:${src}`);
    })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [native, userId, src]);
  if (
    native &&
    userId &&
    src &&
    /^https?:\/\/|^\/uploads\//.test(src) &&
    resolved !== `${userId}:${src}`
  )
    return undefined;
  return cached?.src === src && cached?.userId === userId
    ? cached?.url
    : native && src
      ? mobileImageUrl(src)
      : src;
}
