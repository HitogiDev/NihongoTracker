import { Request, Response, NextFunction } from 'express';

export class customError extends Error {
  statusCode: number;
  kind?: string;
  /**
   * Stable identifier the client maps to a translated message. Optional so the
   * hundreds of existing `new customError(message, status)` call sites keep
   * working untouched while they are migrated to `apiError()`.
   */
  code?: string;
  /** Interpolation values for the translated message. */
  params?: Record<string, string | number>;

  constructor(
    message: string,
    statusCode: number,
    kind?: string,
    options?: { code?: string; params?: Record<string, string | number> }
  ) {
    super(message);
    this.statusCode = statusCode;
    this.kind = kind;
    this.code = options?.code;
    this.params = options?.params;
  }
}

export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const error: customError = new customError(
    `Not Found - ${req.originalUrl.toString()}`,
    404,
    undefined,
    {
      code: 'common.routeNotFound',
      params: { path: req.originalUrl.toString() },
    }
  );
  return next(error);
}

export function errorHandler(
  err: customError | Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Asegurar que siempre trabajamos con customError
  const error =
    err instanceof customError
      ? err
      : new customError(err.message || 'Internal Server Error', 500);

  let statusCode = error.statusCode === 200 ? 500 : error.statusCode;
  let message = error.message;
  let code = error.code;

  // Manejo específico de errores de MongoDB
  if (err.name === 'CastError' && 'kind' in err && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found';
    code = 'common.resourceNotFound';
  }

  // Manejo de errores de validación de MongoDB
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    code = 'common.validationError';
  }

  // Manejo específico de errores JWT
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'auth.tokenExpired';
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'auth.invalidToken';
  }

  if (err.name === 'NotBeforeError') {
    statusCode = 401;
    message = 'Token not active';
    code = 'auth.tokenNotActive';
  }

  // Log solo errores del servidor
  if (statusCode >= 500) {
    console.error('Server Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }

  // `message` stays English on purpose: it is the log/Sentry signal and the
  // client's fallback when it does not recognise `code` (e.g. an older build
  // talking to a newer server).
  return res.status(statusCode).json({
    message,
    ...(code && { code }),
    ...(error.params && { params: error.params }),
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
  });
}
