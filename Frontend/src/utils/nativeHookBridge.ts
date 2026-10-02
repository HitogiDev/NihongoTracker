export function nativeBridgeUrl(hash: string, contentId: string | undefined): string | null {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get('ntdc');
  if (!value || !contentId) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'ws:' || url.hostname !== '127.0.0.1' || url.username || url.password
      || url.pathname.split('/').length !== 3 || url.pathname.split('/')[2] !== contentId) return null;
    return url.toString();
  } catch { return null; }
}

