import { Request, Response, NextFunction } from 'express';
import User from '../models/user.model.js';
import { customError } from './errorMiddleware.js';
import { userRoles } from '../types.js';

export function checkPermission(requiredRole: userRoles) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const userFound = await User.findOne({ _id: res.locals.user.id });
      if (!userFound) throw new customError('Unauthorized', 401);

      if (!userFound.roles.includes(requiredRole))
        throw new customError('Unauthorized', 401);
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
      if (!userFound) throw new customError('Unauthorized', 401);

      if (!allowedRoles.some((role) => userFound.roles.includes(role)))
        throw new customError('Unauthorized', 401);
      return next();
    } catch (error) {
      return next(error as customError);
    }
  };
}
