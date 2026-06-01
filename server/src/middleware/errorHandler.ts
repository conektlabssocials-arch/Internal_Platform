import type { ErrorRequestHandler } from 'express';

type AppError = Error & {
  statusCode?: number;
};

export const errorHandler: ErrorRequestHandler = (err: AppError, _req, res, _next) => {
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    message: err.message || 'Something went wrong',
  });
};
