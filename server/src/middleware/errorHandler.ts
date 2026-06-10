import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';

type AppError = Error & {
  statusCode?: number;
  code?: number;
};

export const errorHandler: ErrorRequestHandler = (err: AppError, _req, res, _next) => {
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

  const response: { message: string; stack?: string } = { message };
  if (!production && statusCode >= 500 && err.stack) response.stack = err.stack;
  res.status(statusCode).json(response);
};
