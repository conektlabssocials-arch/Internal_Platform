import 'reflect-metadata';
import '../config/env.js';
import '../config/container.js';
import mongoose from 'mongoose';

import { connectDB } from '../config/db.js';
import { container } from '../config/container.js';
import { TOKENS } from '../config/tokens.js';
import type { IUserRepository } from '../repositories/user.repository.js';

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

const seedAdmin = async () => {
  try {
    await connectDB(mongoUri);

    const userRepository = container.resolve<IUserRepository>(TOKENS.UserRepository);
    const email = 'admin@conektads.com';
    const existingAdmin = await userRepository.findByEmail(email);

    if (existingAdmin) {
      console.log(`Admin user already exists: ${email}`);
      return;
    }

    await userRepository.create({
      name: 'Admin',
      email,
      role: 'admin',
      status: 'active',
    });

    console.log(`Admin user created: ${email}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to seed admin:', message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedAdmin();
