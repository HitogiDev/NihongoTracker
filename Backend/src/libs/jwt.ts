import jwt from 'jsonwebtoken';
import { customError } from '../middlewares/errorMiddleware.js';
import { apiError } from '../i18n/errorCodes.js';
import { Response } from 'express';

export default function generateToken(res: Response, id: string) {
  const privateKey = process.env.TOKEN_SECRET;

  if (!privateKey) {
    throw apiError('integration.privateKeyNotSet', 500, 'Private key is not set');
  }
  try {
    const token = jwt.sign({ id }, privateKey, {
      expiresIn: '30d',
    });
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  } catch (error) {
    throw error as customError;
  }
}
