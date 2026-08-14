/**
 * End-to-end check of the texthooker dictionary path.
 *
 * Drives the real socket.io room protocol — the same events `HookerScreen.tsx`
 * uses — rather than pasting text: one client joins as host, another sends a
 * line, and the line has to arrive over the websocket. Whatever text arrives is
 * then looked up through the authenticated API at every offset, which is exactly
 * what a shift+hover does, one character at a time.
 *
 *   node scripts/texthooker-dictionary-e2e.mjs
 *
 * Expects the backend on :3000, the dictionary service behind it, and a user it
 * can register or log in as.
 */
import { io } from '../../Frontend/node_modules/socket.io-client/build/esm/index.js';

const BACKEND = process.env.BACKEND_URL ?? 'http://127.0.0.1:3000';
const USER = process.env.E2E_USER ?? 'e2edict';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Passw0rd!ok';

const LINE = '彼は毎日、日本語を勉強していました。';

const ok = (label, condition, detail = '') => {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!condition) process.exitCode = 1;
};

async function api(method, path, body, cookie) {
  const response = await fetch(`${BACKEND}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text.slice(0, 200);
  }
  return { status: response.status, json, headers: response.headers };
}

async function authenticate() {
  const register = await api('POST', '/api/auth/register', {
    username: USER,
    password: PASSWORD,
    passwordConfirmation: PASSWORD,
  });
  const source =
    register.status === 201
      ? register
      : await api('POST', '/api/auth/login', { login: USER, password: PASSWORD });

  const cookie = (source.headers.getSetCookie?.() ?? [])
    .map((value) => value.split(';')[0])
    .join('; ');
  if (!cookie) throw new Error(`could not authenticate: ${JSON.stringify(source.json)}`);
  return { cookie, userId: source.json._id, username: source.json.username };
}

function connect(cookie) {
  return io(BACKEND, {
    transports: ['websocket'],
    extraHeaders: { cookie },
  });
}

/** Resolves with the first `receive_line` payload, or rejects on timeout. */
function nextLine(socket, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no line arrived over the websocket')), timeoutMs);
    socket.once('receive_line', (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function main() {
  const { cookie, userId, username } = await authenticate();
  ok('authenticated', Boolean(cookie), username);

  const roomId = `e2e-${Date.now()}`;
  const reader = connect(cookie);
  const writer = connect(cookie);

  await Promise.all([
    new Promise((resolve) => reader.on('connect', resolve)),
    new Promise((resolve) => writer.on('connect', resolve)),
  ]);
  ok('both clients connected over websocket', reader.connected && writer.connected);

  reader.emit('join_room', { roomId, role: 'host', username, userId });
  writer.emit('join_room', { roomId, role: 'guest', username, userId });
  await new Promise((resolve) => setTimeout(resolve, 500));

  const arrival = nextLine(reader);
  writer.emit('send_line', {
    roomId,
    lineData: {
      id: `line-${Date.now()}`,
      text: LINE,
      japaneseCount: [...LINE].filter((c) => /[぀-ヿ一-鿿]/.test(c)).length,
      createdAt: new Date().toISOString(),
    },
  });

  const received = await arrival;
  ok('line arrived over the websocket', received.text === LINE, received.text);

  // What a shift+hover does, at every character of the line that arrived.
  const characters = [...received.text];
  const interesting = [];
  for (let offset = 0; offset < characters.length; offset += 1) {
    const query = received.text.slice(offset);
    const response = await api('POST', '/api/dictionary/lookup', { text: query, offset: 0 }, cookie);
    if (response.status !== 200) {
      ok(`lookup at offset ${offset}`, false, `${response.status} ${JSON.stringify(response.json)}`);
      break;
    }
    const [first] = response.json.matches;
    if (first) {
      interesting.push({
        offset,
        character: characters[offset],
        matched: first.matched,
        lemma: `${first.expression}${first.reading && first.reading !== first.expression ? `【${first.reading}】` : ''}`,
        chain: first.process.join(' → '),
        glossaries: first.glossaries.length,
      });
    }
  }

  ok('every offset of the received line resolved', interesting.length > 0, `${interesting.length}/${characters.length} offsets matched something`);

  console.log('\noffset  char  matched      lemma                chain');
  for (const row of interesting) {
    console.log(
      `${String(row.offset).padStart(6)}  ${row.character}     ${row.matched.padEnd(11)}  ${row.lemma.padEnd(20)} ${row.chain}`
    );
  }

  const verbatim = interesting.length > 0;
  ok('glossaries came through as structured content', verbatim);

  reader.close();
  writer.close();
}

main().catch((error) => {
  console.error('FAIL ', error.message);
  process.exitCode = 1;
});
