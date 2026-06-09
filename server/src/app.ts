import './config/env.js';
import './config/container.js';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import type { Request, Response } from 'express';

import { errorHandler } from './middleware/errorHandler.js';
import mcpRoutes from './mcp/mcp.routes.js';
import apiRoutes from './routes/index.js';

const app = express();

app.use(
  cors({
    credentials: true,
    origin: process.env.CLIENT_URL || true,
  }),
);
app.use(cookieParser());
app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'conekt-ads-internal-api',
  });
});

app.use('/mcp', mcpRoutes);
app.use('/api', apiRoutes);

app.use(errorHandler);

export default app;
