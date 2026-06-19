import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import { logger } from '../utils/logger.js';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Assigns each request a correlation id (reusing an inbound `x-request-id`
 * when present) and logs a single line once the response is finished with the
 * method, path, status code and duration.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const inboundId = req.headers['x-request-id'];
  const requestId = (Array.isArray(inboundId) ? inboundId[0] : inboundId) || randomUUID();

  req.id = requestId;
  res.setHeader('x-request-id', requestId);

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const meta = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
    };

    if (res.statusCode >= 500) {
      logger.error('request failed', meta);
    } else if (res.statusCode >= 400) {
      logger.warn('request completed with client error', meta);
    } else {
      logger.info('request completed', meta);
    }
  });

  next();
};
