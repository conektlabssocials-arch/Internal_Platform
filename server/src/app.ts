import './config/env.js';
import './config/container.js';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import hpp from 'hpp';
import mongoose from 'mongoose';
import passport from 'passport';
import type { Request, Response } from 'express';

import { configureGoogleStrategy } from './config/google.strategy.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalApiLimiter } from './middleware/rateLimit.middleware.js';
import mcpRoutes from './mcp/mcp.routes.js';
import { createMcpOAuthRouter } from './mcp/mcpOAuth.js';
import apiRoutes from './routes/index.js';
import { HttpError } from './utils/httpError.js';

const app = express();
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

configureGoogleStrategy();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(compression());
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new HttpError(403, 'Origin is not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(cookieParser());
app.use(passport.initialize());

if (process.env.MCP_ENABLED === 'true' && process.env.MCP_AUTH_MODE === 'oauth') {
  app.use(createMcpOAuthRouter());
}
app.use('/mcp', express.json({ limit: '10mb' }), mcpRoutes);

app.use('/api', generalApiLimiter);
app.use('/api', express.json({ limit: '2mb' }));
app.use('/api', express.urlencoded({ extended: true, limit: '2mb' }));
app.use('/api', mongoSanitize());
app.use('/api', hpp());

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    time: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.use('/api', apiRoutes);
app.use(errorHandler);

export default app;
