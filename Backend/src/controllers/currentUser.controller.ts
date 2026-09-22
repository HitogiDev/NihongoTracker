import { Request, Response } from 'express';
import { serializeAuthenticatedUser } from '../services/authenticatedUser.js';

export function getCurrentUser(_req: Request, res: Response) {
  return res.status(200).json(serializeAuthenticatedUser(res.locals.user));
}
