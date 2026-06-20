type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const isProduction = process.env.NODE_ENV === 'production';

const resolveLevel = (): LogLevel => {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  if (configured && configured in LEVELS) {
    return configured as LogLevel;
  }
  return isProduction ? 'info' : 'debug';
};

const activeLevel = LEVELS[resolveLevel()];

type Meta = Record<string, unknown>;

const write = (level: LogLevel, message: string, meta?: Meta) => {
  if (LEVELS[level] > activeLevel) return;

  const timestamp = new Date().toISOString();

  if (isProduction) {
    // Structured single-line JSON for log aggregators.
    process.stdout.write(`${JSON.stringify({ timestamp, level, message, ...meta })}\n`);
    return;
  }

  // Human-readable output for local development.
  const suffix = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const line = `${timestamp} [${level.toUpperCase()}] ${message}${suffix}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
};

export const logger = {
  error: (message: string, meta?: Meta) => write('error', message, meta),
  warn: (message: string, meta?: Meta) => write('warn', message, meta),
  info: (message: string, meta?: Meta) => write('info', message, meta),
  debug: (message: string, meta?: Meta) => write('debug', message, meta),
};

export type Logger = typeof logger;
