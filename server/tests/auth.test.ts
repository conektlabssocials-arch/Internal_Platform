import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import request from 'supertest';
import type { Express } from 'express';

import { clearTestDatabase, startTestDatabase, stopTestDatabase } from './setup/testDb.js';
import {
  configureTestEnvironment,
  createTestUser,
  loadTestApp,
  loginTestUser,
} from './setup/testApp.js';

let app: Express;

before(async () => {
  configureTestEnvironment();
  await startTestDatabase();
  app = await loadTestApp();
});
afterEach(clearTestDatabase);
after(stopTestDatabase);

test('development login, current user, logout, and unknown-user checks use real cookies', async () => {
  await createTestUser({
    name: 'Admin User',
    email: 'admin@conektads.com',
    role: 'admin',
  });
  const agent = request.agent(app);

  const login = await agent
    .post('/api/auth/dev-login')
    .send({ email: 'admin@conektads.com' })
    .expect(200);
  assert.match(login.headers['set-cookie'][0], /conekt_test_token=/);

  const me = await agent.get('/api/auth/me').expect(200);
  assert.equal(me.body.user.email, 'admin@conektads.com');
  assert.equal(me.body.user.role, 'admin');

  const logout = await agent.post('/api/auth/logout').expect(200);
  assert.match(logout.headers['set-cookie'][0], /Expires=Thu, 01 Jan 1970/);
  await agent.get('/api/auth/me').expect(401);

  await request(app)
    .post('/api/auth/dev-login')
    .send({ email: 'unknown@conektads.com' })
    .expect(401);
});

test('development login obeys feature flag and inactive users cannot authenticate', async () => {
  await createTestUser({
    email: 'inactive@conektads.com',
    status: 'inactive',
  });
  await request(app)
    .post('/api/auth/dev-login')
    .send({ email: 'inactive@conektads.com' })
    .expect(403);

  process.env.DEV_AUTH_ENABLED = 'false';
  await request(app)
    .post('/api/auth/dev-login')
    .send({ email: 'inactive@conektads.com' })
    .expect(404);
  process.env.DEV_AUTH_ENABLED = 'true';
});

test('Admin-only routes reject Members and allow Admins', async () => {
  const member = await loginTestUser(app, {
    email: 'member@conektads.com',
    role: 'member',
  });
  await member.get('/api/imports/templates').expect(403);
  await member.get('/api/activity/audit').expect(403);

  const admin = await loginTestUser(app, {
    email: 'admin@conektads.com',
    role: 'admin',
  });
  const templates = await admin.get('/api/imports/templates').expect(200);
  assert.equal(templates.body.data.length, 6);
  await admin.get('/api/activity/audit').expect(200);
});
