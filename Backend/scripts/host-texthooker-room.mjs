/**
 * Hold a texthooker room open as host and feed lines into it over the real
 * socket.io protocol, so a browser joined as guest receives them the way it
 * would from a real texthooker client.
 *
 * The host has to stay connected: the room is torn down when it leaves, and a
 * guest joining afterwards is told the room does not exist.
 *
 *   node scripts/host-texthooker-room.mjs <roomId> [secondsToStayAlive]
 */
import { io } from '../../Frontend/node_modules/socket.io-client/build/esm/index.js';

const BACKEND = process.env.BACKEND_URL ?? 'http://127.0.0.1:3000';
const USER = process.env.E2E_USER ?? 'hoverdemo';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Passw0rd!ok';

const roomId = process.argv[2] ?? 'hoverdemo-room';
const stayAlive = Number(process.argv[3] ?? 600);

const LINES = [
  '彼は毎日、日本語を勉強していました。',
  '様々な人々がその日、静かな山道を歩きながら昔の話を語り合っていたそうです。',
  '仝という字は同上を意味します。',
];

const login = await fetch(`${BACKEND}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ login: USER, password: PASSWORD }),
});
const user = await login.json();
const cookie = (login.headers.getSetCookie?.() ?? []).map((v) => v.split(';')[0]).join('; ');
if (!cookie) {
  console.error('could not authenticate:', user);
  process.exit(1);
}

const socket = io(BACKEND, { transports: ['websocket'], extraHeaders: { cookie } });
await new Promise((resolve) => socket.on('connect', resolve));
socket.emit('join_room', { roomId, role: 'host', username: user.username, userId: user._id });
console.log(`hosting ${roomId} as ${user.username} — join at`);
console.log(`  http://localhost:5173/texthooker/session?roomId=${roomId}&mode=guest`);

// Give the guest time to join before anything is sent.
await new Promise((resolve) => setTimeout(resolve, 12_000));

for (const text of LINES) {
  const japaneseCount = [...text].filter((c) => /[぀-ヿ一-鿿]/.test(c)).length;
  socket.emit('send_line', {
    roomId,
    lineData: {
      id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      japaneseCount,
      createdAt: new Date().toISOString(),
    },
  });
  console.log(`sent: ${text}`);
  await new Promise((resolve) => setTimeout(resolve, 1200));
}

console.log(`staying connected for ${stayAlive}s`);
await new Promise((resolve) => setTimeout(resolve, stayAlive * 1000));
socket.close();
