import rateLimit from 'express-rate-limit';

const positiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const windowMs =
  positiveNumber(process.env.RATE_LIMIT_WINDOW_MINUTES, 15) * 60 * 1000;

export const generalApiLimiter = rateLimit({
  windowMs,
  limit: positiveNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 500),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});

export const authLimiter = rateLimit({
  windowMs,
  limit: positiveNumber(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS, 20),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

