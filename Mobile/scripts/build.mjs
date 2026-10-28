import { cp, mkdir, access, rm, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectDir = fileURLToPath(new URL('..', import.meta.url));
const frontendDir = path.resolve(projectDir, '../Frontend');
const webOutput = path.join(frontendDir, 'dist-capacitor');
const local = process.argv.includes('--local');
// Push registration crashes on Android without a Firebase configuration file.
let pushEnabled = true;
try {
  await access(path.join(projectDir, 'android/app/google-services.json'));
} catch {
  pushEnabled = false;
}
const env = {
  ...process.env,
  VITE_PUSH_ENABLED: process.env.VITE_PUSH_ENABLED || String(pushEnabled),
  CAPACITOR_LOCAL: String(local),
  VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || (
    local ? 'http://localhost:3000/api/' : 'https://nihongotracker.app/api/'
  ),
};

function runNode(script, args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// The web bundle imports the plugins from Frontend/package.json, and the
// native project links them from this package. Both lists must match exactly.
async function readInstalledVersion(dir, name) {
  const file = path.join(dir, 'node_modules', name, 'package.json');
  return JSON.parse(await readFile(file, 'utf8')).version;
}
const isCapacitorPackage = (name) =>
  name.startsWith('@capacitor/') || name.startsWith('@aparajita/capacitor-');
const frontendPackage = JSON.parse(
  await readFile(path.join(frontendDir, 'package.json'), 'utf8'),
);
const mismatches = [];
for (const name of Object.keys(frontendPackage.dependencies ?? {})) {
  if (!isCapacitorPackage(name)) continue;
  const web = await readInstalledVersion(frontendDir, name).catch(() => null);
  const native = await readInstalledVersion(projectDir, name).catch(() => null);
  if (!web || web !== native)
    mismatches.push(`${name}: Frontend ${web ?? 'missing'}, Capacitor ${native ?? 'missing'}`);
}
if (mismatches.length) {
  console.error(`Capacitor package versions differ:\n${mismatches.join('\n')}`);
  console.error('Install the same versions in Frontend and in this package.');
  process.exit(1);
}

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this script with npm run sync or npm run android:local.');
runNode(npmCli, ['run', 'build:capacitor'], frontendDir);
const targetDir = path.resolve(projectDir, 'www');
if (path.dirname(targetDir) !== path.resolve(projectDir)) throw new Error('Invalid web output path.');
await rm(targetDir, { recursive: true, force: true });
await mkdir(targetDir, { recursive: true });
await cp(webOutput, targetDir, { recursive: true });
const capCli = path.join(projectDir, 'node_modules/@capacitor/cli/bin/capacitor');
try {
  await access(path.join(projectDir, 'android'));
} catch {
  runNode(capCli, ['add', 'android'], projectDir);
}
runNode(capCli, ['sync', 'android'], projectDir);
if (process.argv.includes('--run')) {
  runNode(capCli, ['run', 'android', '--no-sync'], projectDir);
}
