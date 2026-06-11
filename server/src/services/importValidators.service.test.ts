import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';

import type { IContactRepository } from '../repositories/contact.repository.js';
import type { ICrmEntityRepository } from '../repositories/crmEntity.repository.js';
import type { IInventoryRepository } from '../repositories/inventory.repository.js';
import { ImportValidatorsService } from './importValidators.service.js';

const createService = ({
  inventory = [],
  entities = [],
  contacts = [],
}: {
  inventory?: unknown[];
  entities?: unknown[];
  contacts?: unknown[];
} = {}) =>
  new ImportValidatorsService(
    { find: async () => inventory } as unknown as IInventoryRepository,
    { find: async () => entities } as unknown as ICrmEntityRepository,
    { find: async () => contacts } as unknown as IContactRepository,
  );

test('Outdoor validation requires map fields and keeps imported inventory unconfirmed', async () => {
  const service = createService();
  const invalid = await service.validate('inventory', [
    {
      categoryGroup: 'Outdoor',
      subCategory: 'Hoarding',
      title: 'Site One',
      city: 'Bangalore',
      area: 'Koramangala',
      width: '20',
      height: '10',
      address: 'Sony World Junction',
      longitude: '77.62',
    },
  ]);

  assert.equal(invalid.invalidRows, 1);
  assert.equal(invalid.errors.some((error) => error.field === 'latitude'), true);

  const valid = await service.validate('inventory', [
    {
      categoryGroup: 'Outdoor',
      subCategory: 'Hoarding',
      title: 'Site One',
      city: 'Bangalore',
      area: 'Koramangala',
      width: '20',
      height: '10',
      address: 'Sony World Junction',
      latitude: '12.93',
      longitude: '77.62',
    },
  ]);

  assert.equal(valid.validRows, 1);
  assert.equal(valid.rows[0].data.confirmationStatus, 'never_confirmed');
  assert.equal(valid.rows[0].data.totalSqFt, 200);
});

test('inventory validation detects database and in-file duplicates', async () => {
  const service = createService({
    inventory: [
      {
        categoryGroup: 'Auto',
        subCategory: 'Auto Hood',
        title: 'HSR Fleet',
        city: 'Bangalore',
        area: 'HSR Layout',
      },
    ],
  });
  const row = {
    categoryGroup: 'Auto',
    subCategory: 'Auto Hood',
    title: 'HSR Fleet',
    city: 'Bangalore',
    area: 'HSR Layout',
    width: '3',
    height: '2',
    numberOfVehicles: '20',
  };

  const result = await service.validate('inventory', [
    row,
    { ...row, title: 'New Fleet' },
    { ...row, title: 'New Fleet' },
  ]);

  assert.equal(result.duplicateRows, 2);
  assert.equal(result.validRows, 1);
});

test('contacts resolve CRM by email and reject unknown entities', async () => {
  const entityId = new Types.ObjectId();
  const service = createService({
    entities: [
      {
        _id: entityId,
        entityType: 'Brand',
        name: 'Example Brand',
        email: 'brand@example.com',
      },
    ],
  });

  const result = await service.validate('contacts', [
    {
      crmEntityEmail: ' BRAND@example.com ',
      contactName: 'Rahul',
      email: 'RAHUL@example.com',
      isPrimary: 'yes',
    },
    {
      crmEntityName: 'Missing Brand',
      contactName: 'Missing Contact',
    },
  ]);

  assert.equal(result.validRows, 1);
  assert.equal(result.invalidRows, 1);
  assert.equal(result.rows[0].data.crmEntityId, entityId.toString());
  assert.equal(result.rows[0].data.email, 'rahul@example.com');
  assert.equal(result.rows[0].data.isPrimary, true);
});

test('CRM duplicate detection prefers email and otherwise uses type, name, and city', async () => {
  const service = createService({
    entities: [
      {
        _id: new Types.ObjectId(),
        entityType: 'Brand',
        name: 'Existing Brand',
        email: 'hello@example.com',
        address: { city: 'Bangalore' },
      },
    ],
  });

  const result = await service.validate('crm_entities', [
    { entityType: 'Brand', name: 'Different', email: 'HELLO@example.com' },
    { entityType: 'Brand', name: 'Existing Brand', city: 'Bangalore' },
  ]);

  assert.equal(result.duplicateRows, 2);
});
