import { isNativeApp } from '../utils/nativeRuntime';

export function downloadStatsImage(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function asBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function shareStatsImage(
  blob: Blob,
  filename: string,
  title: string,
  text: string
) {
  if (isNativeApp()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const directory = Directory.Cache;
    const path = `stats-share/${Date.now()}-${filename}`;
    const data = await asBase64(blob);
    const file = await Filesystem.writeFile({
      path,
      data,
      directory,
      recursive: true,
    });
    try {
      await Share.share({ files: [file.uri], title, text, dialogTitle: title });
    } catch (error) {
      await Filesystem.deleteFile({ path, directory }).catch(() => undefined);
      if (error instanceof Error && /cancel/i.test(error.message))
        return 'cancelled';
      throw error;
    }
    // Keep the file available while the receiving app reads it.
    const cached = await Filesystem.readdir({
      path: 'stats-share',
      directory,
    }).catch(() => null);
    if (cached) {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      await Promise.allSettled(
        cached.files
          .filter((entry) => entry.mtime < cutoff)
          .map((entry) =>
            Filesystem.deleteFile({
              path: `stats-share/${entry.name}`,
              directory,
            })
          )
      );
    }
    return 'shared';
  }
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({ files: [file], title, text });
    return 'shared';
  }
  downloadStatsImage(blob, filename);
  return 'downloaded';
}
