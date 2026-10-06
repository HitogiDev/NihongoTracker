import { spawnSync } from 'node:child_process';
import { cp, rm, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const backend = fileURLToPath(new URL('../', import.meta.url));
const frontend = path.resolve(backend, '../Frontend');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this script through npm run build:frontend');
const build = spawnSync(process.execPath, [npmCli, 'run', 'build'], {
  cwd: frontend,
  stdio: 'inherit',
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);
const source = path.join(frontend, 'dist');
const destination = path.join(backend, 'dist');
await access(path.join(source, 'index.html'));
if (
  path.dirname(destination) !== path.resolve(backend) ||
  path.basename(destination) !== 'dist'
) {
  throw new Error('Invalid build destination');
}
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true });
