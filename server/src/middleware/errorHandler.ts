import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';

import { HttpError } from '../utils/httpError.js';
import { logger } from '../utils/logger.js';

type AppError = Error & {
  statusCode?: number;
  code?: number;
};

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (err: AppError, req, res, _next) => {
  const production = process.env.NODE_ENV === 'production';
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';

  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = Object.values(err.errors).map((error) => error.message).join(', ');
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = 'Invalid identifier or value';
  } else if (err.code === 11000) {
    statusCode = 409;
    message = 'A record with this value already exists';
  } else if (production && statusCode >= 500) {
    message = 'Internal server error';
  }

  if (statusCode >= 500) {
    logger.error('unhandled request error', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode,
      error: err.message,
      stack: err.stack,
    });
  }

  const response: { message: string; stack?: string } = { message };
  if (!production && statusCode >= 500 && err.stack) response.stack = err.stack;
  res.status(statusCode).json(response);
};
