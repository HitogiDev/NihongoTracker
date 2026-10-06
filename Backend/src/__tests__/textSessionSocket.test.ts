import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerTextSessionSockets } from '../services/textSessionSocket.js';

const database = vi.hoisted(() => ({
  findOne: vi.fn(),
  create: vi.fn(),
  updateOne: vi.fn(),
  bulkWrite: vi.fn(),
  deleteOne: vi.fn(),
}));
vi.mock('../models/textSession.model.js', () => ({ default: database }));

function connection(authenticated = true) {
  const handlers: Record<string, (data?: any) => Promise<void>> = {};
  const emit = vi.fn();
  const socket = {
    id: 'socket',
    rooms: new Set(['socket']),
    data: {
      ...(authenticated && {
        user: { userId: 'trusted-id', username: 'trusted' },
      }),
      hostRooms: {} as Record<string, string>,
    },
    on: vi.fn((name: string, handler: (data?: any) => Promise<void>) => {
      handlers[name] = handler;
    }),
    emit,
    join: vi.fn((room: string) => {
      socket.rooms.add(room);
    }),
    to: vi.fn(() => ({ emit })),
  };
  const io = {
    on: vi.fn((_name: string, callback: (value: typeof socket) => void) =>
      callback(socket)
    ),
    in: vi.fn(() => ({ fetchSockets: vi.fn(async () => [socket]) })),
    to: vi.fn(() => ({ emit })),
  };
  registerTextSessionSockets(
    io as unknown as Parameters<typeof registerTextSessionSockets>[0]
  );
  return { socket, handlers, emit };
}

const line = {
  id: 'line-1',
  text: '日本語',
  japaneseCount: 3,
  createdAt: new Date(),
};
beforeEach(() => {
  vi.clearAllMocks();
  database.updateOne.mockResolvedValue({ modifiedCount: 1 });
  database.bulkWrite.mockResolvedValue({ modifiedCount: 1 });
  database.findOne.mockResolvedValue({ hostToken: 'secret', lines: [] });
});

describe('shared text session permissions', () => {
  it.each(['send_line', 'delete_lines', 'restore_lines'])(
    'rejects a guest %s',
    async (event) => {
      const { handlers } = connection();
      await handlers.join_room({ roomId: 'room-a', role: 'guest' });
      await handlers[event]({
        roomId: 'room-a',
        lineData: line,
        lineIds: [line.id],
        lines: [line],
      });
      expect(database.updateOne).not.toHaveBeenCalled();
      expect(database.bulkWrite).not.toHaveBeenCalled();
    }
  );

  it.each(['send_line', 'delete_lines', 'restore_lines'])(
    'rejects a host %s in another room',
    async (event) => {
      const { handlers } = connection();
      await handlers.join_room({
        roomId: 'room-a',
        role: 'host',
        hostToken: 'secret',
      });
      await handlers[event]({
        roomId: 'room-b',
        lineData: line,
        lineIds: [line.id],
        lines: [line],
      });
      expect(database.updateOne).not.toHaveBeenCalled();
      expect(database.bulkWrite).not.toHaveBeenCalled();
    }
  );

  it('deduplicates host lines without creating missing rooms', async () => {
    const { handlers } = connection();
    await handlers.join_room({
      roomId: 'room-a',
      role: 'host',
      hostToken: 'secret',
    });
    await handlers.send_line({ roomId: 'room-a', lineData: line });
    expect(database.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room-a',
        hostToken: 'secret',
        'lines.id': { $ne: line.id },
      }),
      expect.any(Object)
    );
  });

  it('ignores identity supplied by an anonymous guest', async () => {
    const { socket, handlers } = connection(false);
    await handlers.join_room({
      roomId: 'room-a',
      role: 'guest',
      username: 'admin',
      userId: 'admin-id',
    });
    expect(socket.data).not.toHaveProperty('user');
  });

  it('rejects anonymous room creation', async () => {
    database.findOne.mockResolvedValue(null);
    const { handlers } = connection(false);
    await handlers.join_room({ roomId: 'room-a', role: 'host' });
    expect(database.create).not.toHaveBeenCalled();
  });

  it('keeps history after the last member disconnects', async () => {
    const { socket, handlers } = connection();
    socket.rooms.add('room-a');
    await handlers.disconnecting();
    expect(database.deleteOne).not.toHaveBeenCalled();
  });
  it('restores large undo batches in one ordered database call', async () => {
    const { handlers } = connection();
    await handlers.join_room({
      roomId: 'room-a',
      role: 'host',
      hostToken: 'secret',
    });
    const lines = Array.from({ length: 1200 }, (_, index) => ({
      ...line,
      id: String(index),
    }));
    await handlers.restore_lines({
      roomId: 'room-a',
      lines: [...lines, lines[0]],
    });
    expect(database.bulkWrite).toHaveBeenCalledOnce();
    expect(database.bulkWrite.mock.calls[0][0]).toHaveLength(1200);
    expect(database.bulkWrite.mock.calls[0][1]).toEqual({ ordered: true });
  });
});
