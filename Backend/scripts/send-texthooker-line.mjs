/**
 * Send a line into a texthooker room over the real socket.io protocol, so the
 * browser receives it the way a texthooker client would.
 *
 *   node scripts/send-texthooker-line.mjs <roomId> [text]
 */
import { io } from '../../Frontend/node_modules/socket.io-client/build/esm/index.js';

const BACKEND = process.env.BACKEND_URL ?? 'http://127.0.0.1:3000';
const USER = process.env.E2E_USER ?? 'hoverdemo';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Passw0rd!ok';

const roomId = process.argv[2];
const text = process.argv[3] ?? '彼は毎日、日本語を勉強していました。';
if (!roomId) {
  console.error('usage: node scripts/send-texthooker-line.mjs <roomId> [text]');
  process.exit(1);
}

const login = await fetch(`${BACKEND}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ login: USER, password: PASSWORD }),
});
const user = await login.json();
const cookie = (login.headers.getSetCookie?.() ?? [])
  .map((value) => value.split(';')[0])
  .join('; ');
if (!cookie) {
  console.error('could not authenticate:', user);
  process.exit(1);
}

const socket = io(BACKEND, { transports: ['websocket'], extraHeaders: { cookie } });
await new Promise((resolve) => socket.on('connect', resolve));

socket.emit('join_room', {
  roomId,
  role: 'host',
  username: user.username,
  userId: user._id,
});
await new Promise((resolve) => setTimeout(resolve, 600));

const japaneseCount = [...text].filter((c) => /[぀-ヿ一-鿿]/.test(c)).length;
socket.emit('send_line', {
  roomId,
  lineData: {
    id: `line-${Date.now()}`,
    text,
    japaneseCount,
    createdAt: new Date().toISOString(),
  },
});
console.log(`sent to ${roomId}: ${text} (${japaneseCount} japanese characters)`);

await new Promise((resolve) => setTimeout(resolve, 600));
socket.close();
