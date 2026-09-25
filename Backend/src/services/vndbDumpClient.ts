import axios from 'axios';
import fs from 'fs';
import path from 'path';
import type { Readable } from 'stream';

const VNDB_DUMP_URL =
  'https://dl.vndb.org/dump/vndb-db-latest.tar.zst';

/**
 * Resolve the real filename of the latest dump via a HEAD request.
 * VNDB redirects the "latest" URL to a dated file like vndb-db-2026-05-25.tar.zst.
 * We follow redirects and read the final URL's basename as the canonical filename.
 */
export async function getVndbDumpFileName(): Promise<string> {
  const response = await axios.head(VNDB_DUMP_URL, {
    maxRedirects: 10,
    timeout: 30000,
  });

  // axios follows redirects and exposes the final URL via the config
  const finalUrl: string =
    (response.request as { res?: { responseUrl?: string } })?.res
      ?.responseUrl || VNDB_DUMP_URL;

  const basename = path.basename(finalUrl);

  // Fall back to Content-Disposition if the URL didn't change (unlikely but safe)
  if (!basename.startsWith('vndb-db-')) {
    const disposition: string =
      response.headers['content-disposition'] || '';
    const match = disposition.match(/filename[^;=\n]*=([^;\n]*)/);
    if (match) {
      return match[1].replace(/['"]/g, '').trim();
    }
    // Last resort: use URL basename as-is
    return basename || 'vndb-db-latest.tar.zst';
  }

  return basename;
}

/**
 * Stream-download the latest VNDB dump to `destPath`.
 * Uses chunked streaming so we never load the full archive into memory.
 */
export async function downloadVndbDump(destPath: string): Promise<void> {
  const response = await axios.get<Readable>(VNDB_DUMP_URL, {
    responseType: 'stream',
    maxRedirects: 10,
    timeout: 600_000, // 10 min — file is ~500 MB
  });

  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    (response.data as Readable).pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
    (response.data as Readable).on('error', reject);
  });
}
