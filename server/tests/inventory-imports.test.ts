import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import type { Express } from 'express';
import type { SuperAgentTest } from 'supertest';

import { InventoryModel } from '../src/models/inventory.model.js';
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

test('inventory API creates Outdoor and transit inventory with generated codes', async () => {
  await loginAdmin();
  const outdoor = await admin
    .post('/api/inventory')
    .send({
      categoryGroup: 'Outdoor',
      subCategory: 'Hoarding',
      title: 'Koramangala Junction',
      city: 'Bangalore',
      area: 'Koramangala',
      width: 20,
      height: 10,
      location: {
        address: 'Sony World Junction',
        latitude: 12.9352,
        longitude: 77.6245,
        source: 'manual',
      },
    })
    .expect(201);

  assert.match(outdoor.body.data.inventoryCode, /^OUT-BLR-KOR-\d{4}$/);
  assert.equal(outdoor.body.data.totalSqFt, 200);
  assert.equal(outdoor.body.data.confirmationStatus, 'never_confirmed');

  const auto = await admin
    .post('/api/inventory')
    .send({
      categoryGroup: 'Auto',
      subCategory: 'Auto Back Panel',
      title: 'HSR Auto Fleet',
      city: 'Bangalore',
      area: 'HSR Layout',
      width: 3,
      height: 2,
      numberOfVehicles: 50,
    })
    .expect(201);
  assert.equal(auto.body.data.location, undefined);

  await admin
    .post('/api/inventory')
    .send({
      categoryGroup: 'Outdoor',
      subCategory: 'Auto Hood',
      title: 'Invalid Site',
      city: 'Bangalore',
      area: 'Indiranagar',
      width: 10,
      height: 10,
      location: { address: 'Indiranagar', latitude: 12.9, longitude: 77.6 },
    })
    .expect(400);
});

test('inventory API creates A3 property screens without billboard dimensions', async () => {
  await loginAdmin();
  const created = await admin
    .post('/api/inventory')
    .send({
      categoryGroup: 'A3 Screens',
      subCategory: 'Corporate',
      title: 'Ansal Sushant Apartments Screen Network',
      city: 'Gurgaon',
      area: 'Sushant Lok Phase 1 Sector 43',
      propertyName: 'Ansal Sushant Apartments',
      phase: 'Phase 1',
      profile: 'S3',
      pinCode: '122001',
      propertyPriceUptoCr: 17,
      screenSize: '32 inch LED TV',
      propertyVisualLink: 'https://example.com/property-visual',
      numberOfScreens: 4,
      households: 202,
      approxReach: 898,
      monthlyImpressions: 26670,
      monthlyAdBudget: 14000,
      discountedMonthlyAdBudget: 9100,
      mediaSiteId: 'MSQEWQ',
      buildingAge: 23,
      propertyType: 'RESIDENTIAL',
      nccsClass: 'A3',
      location: {
        latitude: 28.459046,
        longitude: 77.080014,
        source: 'manual',
      },
    })
    .expect(201);

  assert.match(created.body.data.inventoryCode, /^A3-GUR-SLP-\d{4}$/);
  assert.equal(created.body.data.sellingPrice, 9100);
  assert.equal(created.body.data.screenSize, '32 inch LED TV');
  assert.equal(created.body.data.width, undefined);
  assert.equal(created.body.data.location.latitude, 28.459046);
});

test('confirming inventory makes it fresh', async () => {
  await loginAdmin();
  const created = await admin
    .post('/api/inventory')
    .send({
      categoryGroup: 'Auto',
      subCategory: 'Auto Hood',
      title: 'Confirmed Fleet',
      city: 'Bangalore',
      area: 'BTM',
      width: 3,
      height: 2,
      route: 'BTM to HSR',
    })
    .expect(201);

  const confirmed = await admin
    .patch(`/api/inventory/${created.body.data.id}/confirm`)
    .send({ availabilityStatus: 'available' })
    .expect(200);
  assert.equal(confirmed.body.data.confirmationStatus, 'fresh');
  assert.ok(confirmed.body.data.lastConfirmedAt);
});

test('CSV import validates before commit and keeps imported inventory unconfirmed', async () => {
  await loginAdmin();
  const csv = [
    'categoryGroup,subCategory,title,city,area,address,latitude,longitude,width,height,availabilityStatus',
    'Outdoor,Hoarding,Valid Site,Bangalore,Koramangala,Sony World Junction,12.9352,77.6245,20,10,available',
    'Outdoor,Hoarding,Missing Latitude,Bangalore,Indiranagar,100 Feet Road,,77.6400,20,10,available',
  ].join('\n');

  const upload = await admin
    .post('/api/imports/inventory/upload')
    .attach('file', Buffer.from(csv), {
      filename: 'outdoor.csv',
      contentType: 'text/csv',
    })
    .expect(201);

  const validation = await admin
    .post(`/api/imports/jobs/${upload.body.data.id}/validate`)
    .expect(200);
  assert.equal(validation.body.data.summary.validRows, 1);
  assert.equal(validation.body.data.summary.invalidRows, 1);
  assert.equal(
    validation.body.data.errors.some(
      (error: { rowNumber: number; field: string }) =>
        error.rowNumber === 3 && error.field === 'latitude',
    ),
    true,
  );

  const committed = await admin
    .post(`/api/imports/jobs/${upload.body.data.id}/commit`)
    .expect(200);
  assert.equal(committed.body.data.summary.importedRows, 1);

  const imported = await InventoryModel.findOne({ title: 'Valid Site' }).lean();
  assert.equal(imported?.confirmationStatus, 'never_confirmed');
  assert.equal(imported?.lastConfirmedAt, undefined);
  assert.equal(await InventoryModel.countDocuments(), 1);
});
