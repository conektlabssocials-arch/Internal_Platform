import 'reflect-metadata';
import './config/env.js';

import app from './app.js';
import { connectDB } from './config/db.js';
import { ensureDocumentStorage } from './services/pdf.service.js';

const PORT = process.env.PORT || 5000;
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

const startServer = async () => {
  try {
    await ensureDocumentStorage();
    await connectDB(mongoUri);

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    console.error('Failed to start server:', message);
    process.exit(1);
  }
};

startServer();
