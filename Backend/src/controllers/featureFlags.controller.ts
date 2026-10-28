import { NextFunction, Request, Response } from 'express';
import { apiError } from '../i18n/errorCodes.js';
import { customError } from '../middlewares/errorMiddleware.js';
import {
  getFeatureFlags,
  isFeatureFlag,
  setFeatureFlag,
} from '../services/featureFlags.service.js';

export async function listFeatureFlags(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    return res.status(200).json(await getFeatureFlags());
  } catch (error) {
    return next(error as customError);
  }
}

export async function updateFeatureFlag(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { key } = req.params;
    if (!isFeatureFlag(key)) {
      throw apiError('common.resourceNotFound', 404, 'Feature not found');
    }
    if (typeof req.body?.enabled !== 'boolean') {
      throw apiError(
        'common.validationError',
        400,
        'enabled must be a boolean'
      );
    }
    return res.status(200).json(await setFeatureFlag(key, req.body.enabled));
  } catch (error) {
    return next(error as customError);
  }
}
