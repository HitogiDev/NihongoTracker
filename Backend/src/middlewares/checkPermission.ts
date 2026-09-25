import { Request, Response, NextFunction } from 'express';
import { customError } from '../middlewares/errorMiddleware.js';
import { apiError } from '../i18n/errorCodes.js';
import User from '../models/user.model.js';
import { userRoles } from '../types.js';

export function checkPermission(requiredRole: userRoles) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const userFound = await User.findOne({ _id: res.locals.user.id });
      if (!userFound) throw apiError('auth.forbidden', 401, 'Unauthorized');

      if (!userFound.roles.includes(requiredRole))
        throw apiError('auth.forbidden', 401, 'Unauthorized');
      return next();
    } catch (error) {
      return next(error as customError);
    }
  };
}

// Passes when the user holds ANY of the given roles (e.g. admin OR mod).
export function checkAnyPermission(...allowedRoles: userRoles[]) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const userFound = await User.findOne({ _id: res.locals.user.id });
      if (!userFound) throw apiError('auth.forbidden', 401, 'Unauthorized');

      if (!allowedRoles.some((role) => userFound.roles.includes(role)))
        throw apiError('auth.forbidden', 401, 'Unauthorized');
      return next();
    } catch (error) {
      return next(error as customError);
    }
  };
}
