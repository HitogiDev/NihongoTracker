import { spawn } from 'child_process';
import fs from 'fs/promises';

/**
 * Extract a .tar.zst archive by shelling out to `tar --zstd`.
 * Requires `tar` and `zstd` to be installed on the system
 * (add `zstd` to the Dockerfile's apt-get install list).
 */
export async function extractVndbDump(
  archivePath: string,
  destDir: string
): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const proc = spawn('tar', [
      '-x',
      '--zstd',
      '-f',
      archivePath,
      '-C',
      destDir,
    ]);

    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      process.stdout.write(chunk);
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });

    proc.on('error', (err) => {
      reject(
        new Error(`Failed to spawn tar: ${err.message}`)
      );
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `tar exited with code ${code}. stderr: ${stderr.slice(0, 500)}`
          )
        );
      }
    });
  });
}

/**
 * Recursively delete the temp directory used for the dump.
 * Errors are swallowed and logged so cleanup failures never mask the real error.
 */
export async function cleanupDumpDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
    console.log(`🧹 VNDB dump temp dir cleaned up: ${dir}`);
  } catch (error) {
    console.warn(`⚠️  Could not clean up VNDB temp dir ${dir}:`, error);
  }
}
