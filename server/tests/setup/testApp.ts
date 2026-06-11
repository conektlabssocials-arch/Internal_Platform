import type { Express } from 'express';
import request from 'supertest';
import type { SuperAgentTest } from 'supertest';

import { UserModel } from '../../src/models/user.model.js';
import type { UserRole, UserStatus } from '../../src/models/user.model.js';

export type TestUserInput = {
  name?: string;
  email: string;
  role?: UserRole;
  status?: UserStatus;
};

export const configureTestEnvironment = () => {
  process.env.NODE_ENV = 'development';
  process.env.DEV_AUTH_ENABLED = 'true';
  process.env.JWT_SECRET = 'integration-test-secret-at-least-32-characters';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.COOKIE_NAME = 'conekt_test_token';
  process.env.CLIENT_URL = 'http://localhost:5173';
  process.env.SERVER_URL = 'http://localhost:5000';
  process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_CALLBACK_URL = 'http://localhost:5000/api/auth/google/callback';
  process.env.GENERAL_RATE_LIMIT_MAX_REQUESTS = '10000';
  process.env.RATE_LIMIT_MAX_REQUESTS = '10000';
  process.env.AUTH_RATE_LIMIT_MAX_REQUESTS = '10000';
  process.env.MCP_ENABLED = 'false';
};

export const loadTestApp = async (): Promise<Express> => {
  configureTestEnvironment();
  return (await import('../../src/app.js')).default;
};

export const createTestUser = (input: TestUserInput) =>
  UserModel.create({
    name: input.name || input.email.split('@')[0],
    email: input.email.toLowerCase(),
    role: input.role || 'member',
    status: input.status || 'active',
    authProvider: 'dev',
  });

export const loginTestUser = async (
  app: Express,
  input: TestUserInput,
): Promise<SuperAgentTest> => {
  await createTestUser(input);
  const agent = request.agent(app);
  const response = await agent
    .post('/api/auth/dev-login')
    .send({ email: input.email })
    .expect(200);

  if (!response.headers['set-cookie']) {
    throw new Error('Test login did not set an authentication cookie');
  }

  return agent;
};
