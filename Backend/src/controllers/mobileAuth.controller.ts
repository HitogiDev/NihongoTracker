import { Request, Response, NextFunction } from 'express';
import MobileSession from '../models/mobileSession.model.js';
import { rotateMobileSession } from '../services/mobileSessions.service.js';
import { apiError } from '../i18n/errorCodes.js';
import { customError } from '../middlewares/errorMiddleware.js';

export async function refreshMobileSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { sessionId, refreshToken } = req.body as {
      sessionId?: string;
      refreshToken?: string;
    };
    if (typeof sessionId !== 'string' || typeof refreshToken !== 'string') {
      throw apiError('auth.invalidToken', 401, 'Invalid mobile session');
    }

    const session = await rotateMobileSession(sessionId, refreshToken);
    if (!session) {
      throw apiError('auth.invalidToken', 401, 'Mobile session expired');
    }

    return res.status(200).json({ session });
  } catch (error) {
    return next(error as customError);
  }
}

export async function logoutMobile(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const sessionId = res.locals.mobileSessionId;
    await MobileSession.deleteOne({ _id: sessionId, user: res.locals.user._id });
    return res.status(200).json({ message: 'User logged out' });
  } catch (error) {
    return next(error as customError);
  }
}

/** Save or remove the FCM token of the current mobile session. */
export async function updateMobilePushToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { token } = req.body as { token?: unknown };
    if (
      token !== null &&
      (typeof token !== 'string' || !token.trim() || token.length > 4096)
    ) {
      throw apiError('common.validationError', 400, 'Invalid push token');
    }
    const sessionId = res.locals.mobileSessionId;
    if (token) {
      // A device token belongs to the most recent session that registered it.
      await MobileSession.updateMany(
        { pushToken: token.trim(), _id: { $ne: sessionId } },
        { $unset: { pushToken: 1 } }
      );
      await MobileSession.updateOne(
        { _id: sessionId, user: res.locals.user._id },
        { $set: { pushToken: token.trim() } }
      );
    } else {
      await MobileSession.updateOne(
        { _id: sessionId, user: res.locals.user._id },
        { $unset: { pushToken: 1 } }
      );
    }
    return res.status(204).end();
  } catch (error) {
    return next(error as customError);
  }
}
