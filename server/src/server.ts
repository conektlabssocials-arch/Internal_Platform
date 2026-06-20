import 'reflect-metadata';
import './config/env.js';

import type { Server } from 'node:http';
import mongoose from 'mongoose';

import { connectDB } from './config/db.js';
import { validateEnvironment } from './config/validateEnv.js';
import { logger } from './utils/logger.js';

const PORT = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

const registerProcessHandlers = (server: Server) => {
  const shutdown = async (signal: string) => {
    logger.info('Shutting down server', { signal });
    server.close(() => logger.info('HTTP server closed'));
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error during shutdown', { error: message });
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });
};

const startServer = async () => {
  try {
    validateEnvironment();
    await connectDB(mongoUri);

    const { default: app } = await import('./app.js');
    const server = app.listen(PORT, () => {
      logger.info('Server started', {
        port: PORT,
        env: process.env.NODE_ENV || 'development',
      });
    });

    registerProcessHandlers(server);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to start server', { error: message });
    process.exit(1);
  }
};

void startServer();
