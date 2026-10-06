import { randomBytes } from 'node:crypto';
import { Server, Socket } from 'socket.io';
import TextSession from '../models/textSession.model.js';
import {
  IClientToServerEvents,
  IServerToClientEvents,
  ISocketData,
  ISocketLineData,
} from '../types.js';

type RoomServer = Server<
  IClientToServerEvents,
  IServerToClientEvents,
  {},
  ISocketData
>;
type RoomSocket = Socket<
  IClientToServerEvents,
  IServerToClientEvents,
  {},
  ISocketData
>;

export function roomWriteFilter(
  socket: Pick<RoomSocket, 'rooms' | 'data'>,
  roomId: string
) {
  const hostToken =
    socket.data.hostRooms &&
    Object.prototype.hasOwnProperty.call(socket.data.hostRooms, roomId)
      ? socket.data.hostRooms[roomId]
      : undefined;
  return socket.rooms.has(roomId) && hostToken
    ? { roomId, hostToken, expireAt: { $gt: new Date() } }
    : null;
}

function validLine(line: ISocketLineData): boolean {
  return Boolean(
    line &&
      typeof line.id === 'string' &&
      line.id.length > 0 &&
      line.id.length <= 128 &&
      typeof line.text === 'string' &&
      line.text.length <= 100_000 &&
      Number.isFinite(line.japaneseCount) &&
      line.japaneseCount >= 0 &&
      Number.isFinite(new Date(line.createdAt).getTime()) &&
      (line.elapsedSeconds === undefined ||
        (Number.isFinite(line.elapsedSeconds) && line.elapsedSeconds >= 0))
  );
}

function toDbLine(line: ISocketLineData) {
  return {
    id: line.id,
    text: line.text,
    charsCount: line.japaneseCount,
    createdAt: line.createdAt,
    elapsedSeconds: line.elapsedSeconds,
  };
}

export function registerTextSessionSockets(io: RoomServer) {
  io.on('connection', (socket) => {
    socket.on('join_room', async (data) => {
      const roomId = typeof data === 'string' ? data : data?.roomId;
      const role = typeof data === 'object' ? data?.role : 'guest';
      const token = typeof data === 'object' ? data?.hostToken : undefined;
      if (
        typeof roomId !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(roomId) ||
        roomId === socket.id
      ) {
        socket.emit('error_message', 'Invalid room ID');
        return;
      }
      try {
        let session = await TextSession.findOne({
          roomId,
          expireAt: { $gt: new Date() },
        });
        if (role === 'host') {
          if (
            !socket.data.user ||
            (session && (!token || session.hostToken !== token))
          ) {
            socket.emit(
              'error_message',
              'You are not authorized to host this room.'
            );
            return;
          }
          if (!session) {
            // Remove expired rooms before reusing their unique ID.
            await TextSession.deleteOne({
              roomId,
              expireAt: { $lte: new Date() },
            });
            const hostToken = randomBytes(32).toString('hex');
            session = await TextSession.create({
              roomId,
              hostToken,
              lines: [],
              expireAt: new Date(Date.now() + 86_400_000),
            });
            socket.emit('room_created', { roomId, hostToken });
          }
          socket.data.hostRooms = {
            ...socket.data.hostRooms,
            [roomId]: session.hostToken!,
          };
        } else if (!session) {
          socket.emit('error_message', 'Room does not exist.');
          return;
        } else {
          delete socket.data.hostRooms?.[roomId];
        }
        await socket.join(roomId);
        socket.data.role = role === 'host' ? 'host' : 'guest';
        socket.emit('room_joined', { role: socket.data.role, roomId });
        if (session.lines.length) {
          socket.emit(
            'load_history',
            session.lines.map((line) => ({
              id: line.id,
              text: line.text,
              japaneseCount: line.charsCount,
              createdAt: line.createdAt,
              elapsedSeconds: line.elapsedSeconds,
            }))
          );
        }
        const sockets = await io.in(roomId).fetchSockets();
        io.to(roomId).emit(
          'room_users_update',
          sockets.map((member) => ({
            id: member.id,
            role: member.data.hostRooms?.[roomId] ? 'host' : 'guest',
            username: member.data.user?.username,
            userId: member.data.user?.userId,
          }))
        );
      } catch (error) {
        console.error('Error in join_room:', error);
        socket.emit('error_message', 'Internal server error');
      }
    });

    socket.on('send_line', async (data) => {
      const filter = roomWriteFilter(socket, data?.roomId);
      if (!filter || !validLine(data?.lineData)) return;
      try {
        const result = await TextSession.updateOne(
          { ...filter, 'lines.id': { $ne: data.lineData.id } },
          { $push: { lines: toDbLine(data.lineData) } }
        );
        if (result.modifiedCount)
          socket.to(data.roomId).emit('receive_line', data.lineData);
      } catch (error) {
        console.error('Room line update failed:', error);
      }
    });

    socket.on('delete_lines', async (data) => {
      const filter = roomWriteFilter(socket, data?.roomId);
      if (
        !filter ||
        !Array.isArray(data?.lineIds) ||
        !data.lineIds.every((id) => typeof id === 'string' && id.length <= 128)
      )
        return;
      try {
        const result = await TextSession.updateOne(filter, {
          $pull: { lines: { id: { $in: data.lineIds } } },
        });
        if (result.modifiedCount)
          socket
            .to(data.roomId)
            .emit('lines_deleted', { lineIds: data.lineIds });
      } catch (error) {
        console.error('Room line deletion failed:', error);
      }
    });

    socket.on('restore_lines', async (data) => {
      const filter = roomWriteFilter(socket, data?.roomId);
      if (
        !filter ||
        !Array.isArray(data?.lines) ||
        data.lines.length === 0 ||
        !data.lines.every(validLine)
      )
        return;
      try {
        const restored = [
          ...new Map(data.lines.map((line) => [line.id, line])).values(),
        ];
        const result = await TextSession.bulkWrite(
          restored.map((line) => ({
            updateOne: {
              filter: { ...filter, 'lines.id': { $ne: line.id } },
              update: { $push: { lines: toDbLine(line) } },
            },
          })),
          { ordered: true }
        );
        if (result.modifiedCount)
          socket.to(data.roomId).emit('lines_restored', { lines: restored });
      } catch (error) {
        console.error('Room line restoration failed:', error);
      }
    });

    socket.on('disconnecting', async () => {
      try {
        for (const roomId of socket.rooms) {
          if (roomId !== socket.id) {
            const sockets = await io.in(roomId).fetchSockets();
            io.to(roomId).emit(
              'room_users_update',
              sockets
                .filter((member) => member.id !== socket.id)
                .map((member) => ({
                  id: member.id,
                  role: member.data.hostRooms?.[roomId] ? 'host' : 'guest',
                  username: member.data.user?.username,
                  userId: member.data.user?.userId,
                }))
            );
          }
        }
      } catch (error) {
        console.error('Room member update failed:', error);
      }
    });
  });
}
