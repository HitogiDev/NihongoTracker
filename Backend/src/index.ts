import 'dotenv/config';
import app from './app.js';
import { connectDB } from './db.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import TextSession from './models/textSession.model.js';
import jwt from 'jsonwebtoken';
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
  syncAllMedia,
} from './services/meilisearch/mediaIndex.js';
import meiliClient from './services/meilisearch/meiliClient.js';

connectDB();

const MEILI_STARTUP_TIMEOUT_MS = 90000;
const MEILI_RETRY_INTERVAL_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
}

bootstrapMeilisearch().catch((err) =>
  console.error('Meilisearch init error:', err)
);

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

if (process.env.NODE_ENV === 'production') {
  corsOrigins.push(true);
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
      const user = await User.findById(decoded.id).select('username _id');
      if (user) {
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

io.on('connection', (socket) => {
  socket.on('join_room', async (data) => {
    const roomId = typeof data === 'string' ? data : data.roomId;
    const role = typeof data === 'object' ? data.role : 'guest';
    const token = typeof data === 'object' ? data.hostToken : null;

    if (!socket.data.user && typeof data === 'object' && data.username) {
      socket.data.user = {
        username: data.username,
        userId: data.userId,
      };
    }

    try {
      let session = await TextSession.findOne({ roomId });

      if (role === 'host') {
        if (session) {
          if (session.hostToken === token) {
            socket.join(roomId);
            socket.data.role = 'host';
            socket.emit('room_joined', { role: 'host', roomId });
            if (session.lines.length > 0) {
              const history = session.lines.map((line) => ({
                id: line.id,
                text: line.text,
                japaneseCount: line.charsCount,
                createdAt: line.createdAt,
              }));
              socket.emit('load_history', history);
            }
          } else {
            socket.emit(
              'error_message',
              'Room already exists. You are not the host.'
            );
          }
        } else {
          // Create room
          const hostToken =
            token ||
            Math.random().toString(36).substring(2) + Date.now().toString(36);
          session = await TextSession.create({
            roomId,
            hostToken,
            lines: [],
            expireAt: new Date(Date.now() + 86400000), // 24 hours
          });
          socket.join(roomId);
          socket.data.role = 'host';
          socket.emit('room_created', { roomId, hostToken });
          socket.emit('room_joined', { role: 'host', roomId });
        }
      } else {
        // Guest
        if (session) {
          socket.join(roomId);
          socket.data.role = 'guest';
          socket.emit('room_joined', { role: 'guest', roomId });
          if (session.lines.length > 0) {
            const history = session.lines.map((l) => ({
              id: l.id,
              text: l.text,
              japaneseCount: l.charsCount,
              createdAt: l.createdAt,
            }));
            socket.emit('load_history', history);
          }
        } else {
          socket.emit('error_message', 'Room does not exist.');
        }
      }

      // Broadcast updated user list
      if (socket.rooms.has(roomId)) {
        const sockets = await io.in(roomId).fetchSockets();
        const members = sockets.map((s) => ({
          id: s.id,
          role: s.data.role || 'guest',
          username: s.data.user?.username,
          userId: s.data.user?.userId,
        }));
        console.log('Emitting room_users_update:', members);
        io.to(roomId).emit('room_users_update', members);
      }
    } catch (error) {
      console.error('Error in join_room:', error);
      socket.emit('error_message', 'Internal server error');
    }
  });

  socket.on('send_line', async (data) => {
    const { roomId, lineData } = data;

    try {
      if (!lineData?.id) {
        return;
      }

      const dbLine = {
        id: lineData.id,
        text: lineData.text,
        charsCount: lineData.japaneseCount,
        createdAt: lineData.createdAt,
      };

      const updateResult = await TextSession.updateOne(
        { roomId, 'lines.id': { $ne: lineData.id } },
        {
          $push: { lines: dbLine },
          $setOnInsert: {
            roomId,
            expireAt: new Date(Date.now() + 86400000),
          },
        },
        { upsert: true }
      );

      if (updateResult.modifiedCount > 0 || updateResult.upsertedCount > 0) {
        socket.to(roomId).emit('receive_line', lineData);
      }
    } catch (error) {}
  });

  socket.on('delete_lines', async (data) => {
    const { roomId, lineIds } = data;
    try {
      if (socket.data.role !== 'host') return;
      await TextSession.updateOne(
        { roomId },
        { $pull: { lines: { id: { $in: lineIds } } } }
      );
      socket.to(roomId).emit('lines_deleted', { lineIds });
    } catch (error) {}
  });

  socket.on('restore_lines', async (data) => {
    const { roomId, lines } = data;
    try {
      if (socket.data.role !== 'host') return;

      const dbLines = lines.map((lineData) => ({
        id: lineData.id,
        text: lineData.text,
        charsCount: lineData.japaneseCount,
        createdAt: lineData.createdAt,
      }));

      await TextSession.updateOne(
        { roomId },
        { $push: { lines: { $each: dbLines } } }
      );
      socket.to(roomId).emit('lines_restored', { lines });
    } catch (error) {}
  });

  socket.on('disconnecting', async () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        const sockets = await io.in(roomId).fetchSockets();
        const remainingMembers = sockets.filter((s) => s.id !== socket.id);

        if (remainingMembers.length === 0) {
          try {
            await TextSession.deleteOne({ roomId });
            console.log(`Room ${roomId} deleted - no users remaining`);
          } catch (error) {
            console.error(`Error deleting room ${roomId}:`, error);
          }
        } else {
          // Notify remaining members
          const members = remainingMembers.map((s) => ({
            id: s.id,
            role: s.data.role || 'guest',
            username: s.data.user?.username,
            userId: s.data.user?.userId,
          }));
          io.to(roomId).emit('room_users_update', members);
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

httpServer.listen(process.env.PORT, () => {
  console.log('🚀 Server on port:', process.env.PORT);
});
