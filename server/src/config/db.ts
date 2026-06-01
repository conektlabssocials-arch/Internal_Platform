import mongoose from 'mongoose';

export const connectDB = async (mongoUri?: string) => {
  if (!mongoUri) {
    throw new Error('MONGO_URI or MONGODB_URI is required');
  }

  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
};
