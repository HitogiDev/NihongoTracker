import fs from 'fs';
import readline from 'readline';

/**
 * Read a VNDB .header file (single tab-separated line of column names).
 * Returns the column names in order.
 */
export async function readHeaderFile(filePath: string): Promise<string[]> {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  return content.trim().split('\t');
}

/**
 * Unescape PostgreSQL COPY format escape sequences.
 * Handles: \\ → \, \n → newline, \t → tab, \r → carriage return
 */
function unescapePostgresCopy(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\');
}

/**
 * Stream a VNDB TSV data file row by row.
 * Column names are supplied from the corresponding .header file.
 * NULL values (\N in the file) are yielded as null.
 *
 * Uses readline for memory-efficient line-by-line processing —
 * files can be hundreds of MB.
 */
export async function* streamTsvRows(
  dataFilePath: string,
  headers: string[]
): AsyncGenerator<Record<string, string | null>> {
  const fileStream = fs.createReadStream(dataFilePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line) continue;

    const cells = line.split('\t');
    const row: Record<string, string | null> = {};

    for (let i = 0; i < headers.length; i++) {
      const raw = cells[i];
      if (raw === undefined || raw === '\\N') {
        row[headers[i]] = null;
      } else {
        row[headers[i]] = unescapePostgresCopy(raw);
      }
    }

    yield row;
  }
}
