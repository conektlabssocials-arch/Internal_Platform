import mongoose from 'mongoose';

import { logger } from '../utils/logger.js';

export const connectDB = async (mongoUri?: string) => {
  if (!mongoUri) {
    throw new Error('MONGO_URI or MONGODB_URI is required');
  }

  await mongoose.connect(mongoUri);
  logger.info('MongoDB connected');
};
