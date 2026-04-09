import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import ApiKey from '../models/apiKey.model.js';
import { customError } from '../middlewares/errorMiddleware.js';

const MAX_KEYS_PER_USER = 10;

function hashKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * POST /api/api-keys
 * Generate a new API key for the authenticated user.
 * Body: { name: string, expiresAt?: string (ISO date) }
 * Returns the raw key ONCE — it cannot be retrieved again.
 */
export async function generateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = res.locals.user;
    const { name, expiresAt } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new customError('API key name is required', 400);
    }

    if (name.trim().length > 100) {
      throw new customError('API key name must be 100 characters or less', 400);
    }

    // Check key count limit
    const existingCount = await ApiKey.countDocuments({ user: user._id });
    if (existingCount >= MAX_KEYS_PER_USER) {
      throw new customError(
        `You can have a maximum of ${MAX_KEYS_PER_USER} API keys`,
        400
      );
    }

    // Generate a secure random key with a recognizable prefix
    const rawKey = `ntk_${crypto.randomBytes(32).toString('hex')}`;
    const hashedKey = hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 12); // "ntk_" + first 8 hex chars

    const apiKey = await ApiKey.create({
      key: hashedKey,
      keyPrefix,
      name: name.trim(),
      user: user._id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    return res.status(201).json({
      _id: apiKey._id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      key: rawKey, // Only time the raw key is returned
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/api-keys
 * List all API keys for the authenticated user.
 * Returns metadata only — never the raw key.
 */
export async function listApiKeys(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = res.locals.user;

    const keys = await ApiKey.find({ user: user._id })
      .select('-key')
      .sort({ createdAt: -1 })
      .lean();

    return res.json(keys);
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/api-keys/:id
 * Revoke (delete) an API key belonging to the authenticated user.
 */
export async function deleteApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = res.locals.user;
    const { id } = req.params;

    const apiKey = await ApiKey.findOneAndDelete({
      _id: id,
      user: user._id,
    });

    if (!apiKey) {
      throw new customError('API key not found', 404);
    }

    return res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    return next(error);
  }
}
