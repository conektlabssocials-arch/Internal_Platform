import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import type { Express } from 'express';
import type { SuperAgentTest } from 'supertest';

import { clearTestDatabase, startTestDatabase, stopTestDatabase } from './setup/testDb.js';
import {
  configureTestEnvironment,
  loadTestApp,
  loginTestUser,
} from './setup/testApp.js';

let app: Express;
let admin: SuperAgentTest;

before(async () => {
  configureTestEnvironment();
  await startTestDatabase();
  app = await loadTestApp();
});
afterEach(clearTestDatabase);
after(stopTestDatabase);

const loginAdmin = async () => {
  admin = await loginTestUser(app, {
    name: 'Admin',
    email: 'admin@conektads.com',
    role: 'admin',
  });
};

test('CRM entity, contact primary handling, and supplier/client searches work through APIs', async () => {
  await loginAdmin();
  const brand = await admin
    .post('/api/crm/entities')
    .send({ entityType: 'Brand', name: 'Nike India', email: 'nike@example.com' })
    .expect(201);
  const supplier = await admin
    .post('/api/crm/entities')
    .send({
      entityType: 'SupplierOwner',
      name: 'Outdoor Supplier',
      email: 'supplier@example.com',
    })
    .expect(201);

  const first = await admin
    .post(`/api/crm/entities/${brand.body.data.id}/contacts`)
    .send({ name: 'First Contact', email: 'first@example.com', isPrimary: true })
    .expect(201);
  const second = await admin
    .post(`/api/crm/entities/${brand.body.data.id}/contacts`)
    .send({ name: 'Second Contact', email: 'second@example.com', isPrimary: true })
    .expect(201);

  const contacts = await admin
    .get(`/api/crm/entities/${brand.body.data.id}/contacts`)
    .expect(200);
  assert.equal(
    contacts.body.data.find((item: { id: string }) => item.id === first.body.data.id).isPrimary,
    false,
  );
  assert.equal(
    contacts.body.data.find((item: { id: string }) => item.id === second.body.data.id).isPrimary,
    true,
  );

  const suppliers = await admin.get('/api/crm/suppliers/search').expect(200);
  assert.deepEqual(suppliers.body.data.map((item: { id: string }) => item.id), [
    supplier.body.data.id,
  ]);
  const clients = await admin.get('/api/crm/clients/search').expect(200);
  assert.equal(
    clients.body.data.some((item: { id: string }) => item.id === supplier.body.data.id),
    false,
  );
});

test('dashboard overview requires auth and returns stable top-level sections', async () => {
  await loginAdmin();
  await (await import('supertest')).default(app).get('/api/dashboard/overview').expect(401);
  const overview = await admin.get('/api/dashboard/overview').expect(200);
  assert.deepEqual(
    Object.keys(overview.body.data).sort(),
    ['campaigns', 'inventory', 'myWork', 'operations', 'plans', 'recentActivity'].sort(),
  );
});
