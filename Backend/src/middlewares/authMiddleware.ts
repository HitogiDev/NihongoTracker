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
    const user = await User.findById((decoded as decodedJWT).id).select(
      '-password'
    );

    // Auto-expire manually-granted patreon tiers
    if (
      user?.patreon?.manualTierExpiry &&
      new Date() > user.patreon.manualTierExpiry
    ) {
      user.patreon.tier = null;
      user.patreon.isActive = false;
      user.patreon.manualTierExpiry = undefined;
      await user.save();
    }

    res.locals.user = user;
    return next();
  } catch (error) {
    res.clearCookie('jwt');
    return next(error);
  }
}
