import { createHash } from 'node:crypto';
import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  forgotPassword,
  resetPassword,
  verifyEmail,
} from '../controllers/auth.controller.js';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  resetEmail: vi.fn(),
}));
vi.mock('../models/user.model.js', () => ({
  default: { findOne: mocks.findOne, findOneAndUpdate: mocks.findOneAndUpdate },
}));
vi.mock('../mailtrap/emails.js', () => ({
  sendPasswordResetEmail: mocks.resetEmail,
  sendPasswordResetSuccessEmail: vi.fn(async () => {}),
  sendVerificationEmail: vi.fn(),
}));
vi.mock('../services/meilisearch/userIndex.js', () => ({ indexUser: vi.fn() }));
const response = () => {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
};
beforeEach(() => vi.clearAllMocks());
describe('password recovery tokens', () => {
  it('sends a random 256-bit token and stores only its hash', async () => {
    const user = { save: vi.fn(), settings: {}, resetPasswordToken: '' };
    mocks.findOne.mockReturnValue({ collation: async () => user });
    const next = vi.fn();
    await forgotPassword(
      { body: { email: 'reader@example.test' } } as Request,
      response(),
      next
    );
    expect(next).not.toHaveBeenCalled();
    const token = new URL(mocks.resetEmail.mock.calls[0][1]).pathname
      .split('/')
      .pop()!;
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(user.resetPasswordToken).toBe(
      createHash('sha256').update(token).digest('hex')
    );
    expect(user.resetPasswordToken).not.toBe(token);
  });
  it('rejects old six-digit reset links', async () => {
    const next = vi.fn();
    await resetPassword(
      {
        params: { token: '123456' },
        body: { password: 'secret', passwordConfirmation: 'secret' },
      } as unknown as Request,
      response(),
      next
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 })
    );
    expect(mocks.findOne).not.toHaveBeenCalled();
  });
  it('requires an unexpired matching hash', async () => {
    const token = 'a'.repeat(64);
    mocks.findOne.mockResolvedValue(null);
    const next = vi.fn();
    await resetPassword(
      {
        params: { token },
        body: { password: 'secret', passwordConfirmation: 'secret' },
      } as unknown as Request,
      response(),
      next
    );
    expect(mocks.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        resetPasswordToken: createHash('sha256').update(token).digest('hex'),
        resetPasswordTokenExpiry: { $gt: expect.any(Date) },
      })
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'auth.invalidResetToken' })
    );
  });
  it('rejects a query object as an email verification token', async () => {
    const next = vi.fn();
    await verifyEmail(
      { body: { token: { $ne: null } } } as Request,
      response(),
      next
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 })
    );
    expect(mocks.findOne).not.toHaveBeenCalled();
  });
  it('allows only one concurrent reset with the same token', async () => {
    const user = { _id: 'user-id', email: 'reader@example.test', settings: {} };
    mocks.findOne.mockResolvedValue(user);
    mocks.findOneAndUpdate
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(null);
    const req = {
      params: { token: 'b'.repeat(64) },
      body: { password: 'secret', passwordConfirmation: 'secret' },
    } as unknown as Request;
    const firstNext = vi.fn();
    const secondNext = vi.fn();
    const first = response();
    const second = response();
    await Promise.all([
      resetPassword(req, first, firstNext),
      resetPassword(req, second, secondNext),
    ]);
    expect(
      [firstNext.mock.calls.length, secondNext.mock.calls.length].sort()
    ).toEqual([0, 1]);
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ resetPasswordToken: expect.any(String) }),
      expect.objectContaining({
        $set: { password: expect.stringMatching(/^\$2[aby]\$/) },
        $unset: { resetPasswordToken: '', resetPasswordTokenExpiry: '' },
      }),
      { runValidators: true }
    );
  });
});
