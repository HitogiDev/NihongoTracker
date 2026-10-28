import { describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../../middlewares/errorMiddleware.js';

function respond(err: Error) {
  const json = vi.fn();
  const res = {
    status: vi.fn(() => ({ json })),
  } as unknown as Response;
  errorHandler(err, {} as Request, res, (() => {}) as NextFunction);
  return {
    status: (res.status as ReturnType<typeof vi.fn>).mock.calls[0][0],
    body: json.mock.calls[0][0],
  };
}

describe('mongoose validation errors', () => {
  const schema = new mongoose.Schema({
    description: { type: String, required: true },
    episodes: { type: Number, min: 1 },
  });
  const Model = mongoose.model('ValidationFieldsProbe', schema);

  it('name every failing path and why', () => {
    const err = new Model({ episodes: 0 }).validateSync();
    expect(err).toBeDefined();

    const { status, body } = respond(err!);

    expect(status).toBe(400);
    expect(body.code).toBe('common.validationError');
    expect(Object.keys(body.fields).sort()).toEqual(['description', 'episodes']);
    expect(body.fields.description).toMatch(/required/);
    expect(body.message).toMatch(/^Validation Error: /);
    expect(body.message).toContain('description');
  });

  it('keep the bare message when mongoose names no path', () => {
    const err = new mongoose.Error.ValidationError();

    const { body } = respond(err);

    expect(body.message).toBe('Validation Error');
    expect(body.fields).toEqual({});
  });
});
