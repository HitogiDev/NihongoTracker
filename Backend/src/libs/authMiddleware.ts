import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import { Request, Response, NextFunction } from 'express';
import { customError } from '../middlewares/errorMiddleware.js';
import { decodedJWT } from '../types.js';

export async function protect(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.jwt;
  if (!token) {
    return next(new customError('Unauthorized, no token', 401));
  }
  try {
    const decoded = jwt.verify(token, process.env.TOKEN_SECRET!);
    res.locals.user = await User.findById((decoded as decodedJWT).id).select(
      '-password'
    );
    return next();
  } catch (error) {
    res.clearCookie('jwt');
    return next(error);
  }
}
