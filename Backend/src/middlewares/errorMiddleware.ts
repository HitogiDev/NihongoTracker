import { Request, Response, NextFunction } from 'express';

export class customError extends Error {
  statusCode: number;
  kind?: string;

  constructor(message: string, statusCode: number, kind?: string) {
    super(message);
    this.statusCode = statusCode;
    this.kind = kind;
  }
}

export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const error: customError = new customError(
    `Not Found - ${req.originalUrl.toString()}`,
    404
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

  // Manejo específico de errores de MongoDB
  if (err.name === 'CastError' && 'kind' in err && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found';
  }

  // Manejo de errores de validación de MongoDB
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  }

  // Manejo específico de errores JWT
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'NotBeforeError') {
    statusCode = 401;
    message = 'Token not active';
  }

  // Log solo errores del servidor
  if (statusCode >= 500) {
    console.error('Server Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
  });
}
