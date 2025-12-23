import 'dotenv/config';
import app from './app.js';
import { connectDB } from './db.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import TextSession from './models/textSession.model.js';
import jwt from 'jsonwebtoken';
import User from './models/user.model.js';

connectDB();

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    // Try to get token from cookies (HTTP-only cookie)
    const cookies = socket.handshake.headers.cookie;
    console.log('Socket cookies:', cookies ? 'Present' : 'Missing');

    let token = null;
    if (cookies) {
      const cookieArray = cookies.split(';').map((c) => c.trim());
      const tokenCookie = cookieArray.find((c) => c.startsWith('jwt='));
      if (tokenCookie) {
        token = tokenCookie.split('=')[1];
      }
    }

    console.log('Socket auth token:', token ? 'Present' : 'Missing');
    if (token) {
      console.log('Attempting to verify token...');
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
      };
      console.log('Token decoded, userId:', decoded.userId);
      const user = await User.findById(decoded.userId).select('username _id');
      console.log('User found:', user ? user.username : 'Not found');
      if (user) {
        socket.data.user = {
          userId: user._id.toString(),
          username: user.username,
        };
        console.log('User authenticated successfully:', user.username);
      } else {
        console.log('User not found in database');
      }
    } else {
      console.log('No token found in cookies');
    }
    next();
  } catch (error) {
    console.log(
      'Socket auth error:',
      error instanceof Error ? error.message : error
    );
    // Allow connection even without valid token, but without user data
    next();
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  if (socket.data.user) {
    console.log(`Authenticated user: ${socket.data.user.username}`);
  }

  socket.on('join_room', async (data) => {
    const roomId = typeof data === 'string' ? data : data.roomId;
    const role = typeof data === 'object' ? data.role : 'guest';
    const token = typeof data === 'object' ? data.hostToken : null;

    // Get user info from join_room event if not already set by cookie auth
    if (!socket.data.user && typeof data === 'object' && data.username) {
      socket.data.user = {
        username: data.username,
        userId: data.userId,
      };
      console.log('User info set from join_room:', data.username);
    }

    console.log(
      `User ${socket.id} (${socket.data.user?.username || 'Anonymous'}) attempting to join room ${roomId} as ${role}`
    );

    try {
      let session = await TextSession.findOne({ roomId });

      if (role === 'host') {
        if (session) {
          // Room exists, check token
          if (session.hostToken === token) {
            socket.join(roomId);
            socket.data.role = 'host';
            socket.emit('room_joined', { role: 'host', roomId });
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
      const dbLine = { ...lineData, charsCount: lineData.japaneseCount };
      delete dbLine.japaneseCount;

      await TextSession.findOneAndUpdate(
        { roomId },
        { $push: { lines: dbLine } },
        { upsert: true, new: true }
      );

      socket.to(roomId).emit('receive_line', lineData);
    } catch (error) {
      console.error('Error saving line:', error);
    }
  });

  socket.on('disconnecting', async () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        const sockets = await io.in(roomId).fetchSockets();
        const remainingMembers = sockets.filter((s) => s.id !== socket.id);

        // If no one remains in the room, delete it from the database
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
