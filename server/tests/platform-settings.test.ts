import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import request from 'supertest';
import type { Express } from 'express';

import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from './setup/testDb.js';
import {
  loadTestApp,
  loginTestUser,
} from './setup/testApp.js';

let app: Express;

before(async () => {
  await startTestDatabase();
  app = await loadTestApp();
});

afterEach(clearTestDatabase);
after(stopTestDatabase);

const outdoorInventory = {
  categoryGroup: 'Outdoor',
  subCategory: 'Hoarding',
  title: 'Member Permission Test Hoarding',
  city: 'Bangalore',
  area: 'Koramangala',
  width: 20,
  height: 10,
  location: {
    address: 'Koramangala, Bangalore',
    latitude: 12.9352,
    longitude: 77.6245,
  },
  availabilityStatus: 'available',
  status: 'active',
};

test('Platform Settings are Admin-only and control Member inventory creation', async () => {
  const member = await loginTestUser(app, {
    email: 'member@conektads.com',
    role: 'member',
  });
  const admin = await loginTestUser(app, {
    email: 'admin@conektads.com',
    role: 'admin',
  });

  await member.get('/api/platform-settings').expect(403);
  await member.post('/api/inventory').send(outdoorInventory).expect(403);

  const accessBefore = await member.get('/api/platform-settings/access').expect(200);
  assert.equal(accessBefore.body.data.permissions['inventory.create'], false);

  const updatedSettings = await admin
    .patch('/api/platform-settings')
    .send({
      memberPermissions: [
        { permission: 'inventory.create', enabled: true },
      ],
    })
    .expect(200);
  assert.equal(
    updatedSettings.body.data.memberPermissions['inventory.create'],
    true,
  );

  const accessAfter = await member.get('/api/platform-settings/access').expect(200);
  assert.equal(accessAfter.body.data.permissions['inventory.create'], true);

  const created = await member
    .post('/api/inventory')
    .send(outdoorInventory)
    .expect(201);
  assert.match(created.body.data.inventoryCode, /^OUT-/);
});
