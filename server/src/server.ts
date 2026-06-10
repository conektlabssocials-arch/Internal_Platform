import 'reflect-metadata';
import './config/env.js';

import { validateEnvironment } from './config/validateEnv.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5000;
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

const startServer = async () => {
  try {
    validateEnvironment();
    await connectDB(mongoUri);
    const { default: app } = await import('./app.js');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to start server:', message);
    process.exit(1);
  }
};

void startServer();
