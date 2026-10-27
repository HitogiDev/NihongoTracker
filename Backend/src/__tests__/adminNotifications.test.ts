import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { sendAdminNotification } from '../controllers/admin.controller.js';

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  insertMany: vi.fn(),
}));

vi.mock('../models/user.model.js', () => ({
  default: { find: mocks.find },
}));
vi.mock('../models/notification.model.js', () => ({
  default: { insertMany: mocks.insertMany },
}));
vi.mock('../services/meilisearch/meiliClient.js', () => ({
  default: {},
  meiliClient: {},
}));

function createResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

async function send(body: Record<string, unknown>) {
  const res = createResponse();
  const next = vi.fn();
  await sendAdminNotification(
    { body } as Request,
    res as unknown as Response,
    next as NextFunction
  );
  return { res, next };
}

function mockUserQuery(users: Array<{ _id: Types.ObjectId; username: string }>) {
  const query = {
    collation: vi.fn(),
    select: vi.fn(),
    lean: vi.fn(),
    cursor: vi.fn(),
  };
  query.collation.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.lean.mockImplementation(() =>
    Object.assign(Promise.resolve(users), query)
  );
  query.cursor.mockReturnValue(
    (async function* () {
      yield* users;
    })()
  );
  mocks.find.mockReturnValue(query);
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insertMany.mockResolvedValue([]);
});

describe('admin notifications', () => {
  it('sends a system notification to each named user', async () => {
    const users = [
      { _id: new Types.ObjectId(), username: 'Alice' },
      { _id: new Types.ObjectId(), username: 'bob' },
    ];
    mockUserQuery(users);

    const { res, next } = await send({
      audience: 'users',
      usernames: ['alice', ' bob ', 'alice'],
      title: '  Maintenance tonight  ',
      body: 'Short downtime.',
    });

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ sent: 2 })
    );
    const docs = mocks.insertMany.mock.calls[0][0];
    expect(docs).toHaveLength(2);
    expect(docs[0]).toMatchObject({
      recipient: users[0]._id,
      type: 'system',
      title: 'Maintenance tonight',
      link: '/notifications',
      entityType: 'admin_broadcast',
    });
  });

  it('stores the Spanish text in meta next to the English fallback', async () => {
    mockUserQuery([{ _id: new Types.ObjectId(), username: 'alice' }]);

    await send({
      audience: 'users',
      usernames: ['alice'],
      title: 'Maintenance tonight',
      body: 'Short downtime.',
      translations: {
        es: { title: ' Mantenimiento esta noche ', body: '' },
        fr: { title: 'Ignored' },
      },
    });

    expect(mocks.insertMany.mock.calls[0][0][0]).toMatchObject({
      title: 'Maintenance tonight',
      body: 'Short downtime.',
      meta: { title_es: 'Mantenimiento esta noche' },
    });
    expect(mocks.insertMany.mock.calls[0][0][0].meta).not.toHaveProperty(
      'body_es'
    );
  });

  it('rejects unknown usernames without sending', async () => {
    mockUserQuery([{ _id: new Types.ObjectId(), username: 'alice' }]);

    const { next } = await send({
      audience: 'users',
      usernames: ['alice', 'ghost'],
      title: 'Hello',
    });

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 })
    );
    expect(mocks.insertMany).not.toHaveBeenCalled();
  });

  it.each(['https://example.com', '//example.com', 'settings'])(
    'rejects the external or relative link %s',
    async (link) => {
      const { next } = await send({ audience: 'all', title: 'Hello', link });

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 })
      );
      expect(mocks.find).not.toHaveBeenCalled();
    }
  );

  it('sends to all users that are not banned from the site', async () => {
    mockUserQuery([
      { _id: new Types.ObjectId(), username: 'a' },
      { _id: new Types.ObjectId(), username: 'b' },
      { _id: new Types.ObjectId(), username: 'c' },
    ]);

    const { res } = await send({
      audience: 'all',
      title: 'New feature',
      link: '/changelog',
    });

    expect(mocks.find).toHaveBeenCalledWith({
      'moderation.banned': { $ne: true },
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ sent: 3 })
    );
    expect(mocks.insertMany.mock.calls[0][0][0]).toMatchObject({
      link: '/changelog',
    });
  });
});
