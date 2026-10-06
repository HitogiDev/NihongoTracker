import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import app from './app.js';
import { connectDB } from './db.js';
import { registerTextSessionSockets } from './services/textSessionSocket.js';
import User from './models/user.model.js';
import {
  IServerToClientEvents,
  IClientToServerEvents,
  ISocketData,
} from './types.js';
import {
  initUsersIndex,
  syncAllUsers,
} from './services/meilisearch/userIndex.js';
import {
  initMediaIndexes,
  syncApprovedRequestMedia,
  syncAllMedia,
} from './services/meilisearch/mediaIndex.js';
import meiliClient from './services/meilisearch/meiliClient.js';
import { initIgdbDumpScheduler } from './services/igdbDumpScheduler.js';
import { initVndbDumpScheduler } from './services/vndbDumpScheduler.js';
import { initAchievementCronScheduler } from './services/achievements/cronAchievements.service.js';
import { initAnilistSyncScheduler } from './services/anilistSyncScheduler.js';



const MEILI_STARTUP_TIMEOUT_MS = 90000;
const MEILI_RETRY_INTERVAL_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForMeilisearchReady() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < MEILI_STARTUP_TIMEOUT_MS) {
    try {
      await meiliClient.health();
      console.log('✅ Meilisearch is reachable');
      return true;
    } catch {
      console.log('⏳ Waiting for Meilisearch to become ready...');
      await sleep(MEILI_RETRY_INTERVAL_MS);
    }
  }

  console.error('❌ Timed out waiting for Meilisearch to become ready');
  return false;
}

async function bootstrapMeilisearch() {
  const meiliReady = await waitForMeilisearchReady();

  if (!meiliReady) {
    return;
  }

  await Promise.all([initUsersIndex(), initMediaIndexes()]);
  await Promise.all([syncAllUsers(), syncAllMedia()]);
  await syncApprovedRequestMedia();
}

const httpServer = createServer(app);

const corsOrigins: (string | boolean)[] = [];
if (process.env.FRONTEND_URL) {
  corsOrigins.push(process.env.FRONTEND_URL);
}
if (
  process.env.PROD_DOMAIN &&
  process.env.PROD_DOMAIN !== process.env.FRONTEND_URL
) {
  corsOrigins.push(process.env.PROD_DOMAIN);
}


if (corsOrigins.length === 0) {
  corsOrigins.push('http://localhost:5173');
}

console.log('Socket.IO CORS origins:', corsOrigins);

const io = new Server<
  IClientToServerEvents,
  IServerToClientEvents,
  {},
  ISocketData
>(httpServer, {
  cors: {
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.use(async (socket, next) => {
  try {
    const cookies = socket.handshake.headers.cookie;
    let token = null;
    if (cookies) {
      const cookieArray = cookies.split(';').map((c) => c.trim());
      const tokenCookie = cookieArray.find((c) => c.startsWith('jwt='));
      if (tokenCookie) {
        token = tokenCookie.split('=')[1];
      }
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.TOKEN_SECRET!) as {
        id: string;
      };
      const user = await User.findById(decoded.id).select('username _id moderation.banned');
      if (user && !user.moderation?.banned) {
        socket.data.user = {
          userId: user._id.toString(),
          username: user.username,
        };
      }
    }
    next();
  } catch (error) {
    // Allow connection even without valid token, but without user data
    next();
  }
});

registerTextSessionSockets(io);

async function startServer() {
  await connectDB();
  bootstrapMeilisearch().catch((error) => console.error('Meilisearch init error:', error));
  initIgdbDumpScheduler();
  initVndbDumpScheduler();
  initAchievementCronScheduler();
  initAnilistSyncScheduler();
  const port = process.env.PORT || 3000;
  httpServer.listen(port, () => console.log('Server on port:', port));
}

startServer().catch((error) => {
  console.error('Server startup failed:', error);
  process.exit(1);
});
