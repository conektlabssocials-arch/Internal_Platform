import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';

import type { IContactRepository } from '../repositories/contact.repository.js';
import type { ICrmEntityRepository } from '../repositories/crmEntity.repository.js';
import type { IInventoryRepository } from '../repositories/inventory.repository.js';
import type { IGeocodingService } from './geocoding.service.js';
import { ImportValidatorsService } from './importValidators.service.js';

const createService = ({
  inventory = [],
  entities = [],
  contacts = [],
  geocode = async () => ({}),
}: {
  inventory?: unknown[];
  entities?: unknown[];
  contacts?: unknown[];
  geocode?: IGeocodingService['reverseGeocode'];
} = {}) =>
  new ImportValidatorsService(
    { find: async () => inventory } as unknown as IInventoryRepository,
    { find: async () => entities } as unknown as ICrmEntityRepository,
    { find: async () => contacts } as unknown as IContactRepository,
    { reverseGeocode: geocode } as IGeocodingService,
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

test('A3 Screens validation maps zone and locality and preserves audience pricing fields', async () => {
  const service = createService();
  const baseRow = {
      categoryGroup: 'A3 Screens',
      subCategory: 'Residential',
      title: 'Ansal Sushant Apartments Screen Network',
      city: 'Gurgaon',
      locality: 'Sushant Lok Phase 1 Sector 43',
      propertyName: 'Ansal Sushant Apartments',
      profile: 'S3',
      pinCode: '122001',
      propertyPriceUptoCr: '17',
      screenSize: '32 inch LED TV',
      numberOfScreens: '4',
      households: '202',
      approxReach: '898',
      monthlyImpressions: '26670',
      address: 'Ansal Sushant Apartments, Gurgaon',
      latitude: '28.459046',
      longitude: '77.080014',
      monthlyAdBudget: '14000',
      discountedMonthlyAdBudget: '9100',
      internalCost: '9100',
      sellingPrice: '12500',
      mediaSiteId: 'MSQEWQ',
      buildingAge: '23',
      propertyType: 'RESIDENTIAL',
      nccsClass: 'A3',
    };
  const result = await service.validate('inventory', [
    baseRow,
    {
      ...baseRow,
      subCategory: 'Corporate',
      title: 'Cyber City Corporate Screen Network',
      locality: 'DLF Cyber City',
      propertyName: 'Corporate Tower One',
      propertyType: 'CORPORATE',
      mediaSiteId: 'MSC001',
    },
  ]);

  assert.equal(result.validRows, 2);
  assert.equal(result.rows[0].data.city, 'Gurgaon');
  assert.equal(result.rows[0].data.area, 'Sushant Lok Phase 1 Sector 43');
  assert.equal(
    (result.rows[0].data.location as { address: string }).address,
    'Ansal Sushant Apartments, Gurgaon',
  );
  assert.equal(result.rows[0].data.internalCost, 9100);
  assert.equal(result.rows[0].data.sellingPrice, 12500);
  assert.equal(result.rows[0].data.width, undefined);
  assert.equal(
    (result.rows[0].data.location as { latitude: number }).latitude,
    28.459046,
  );
});

test('A3 Screens bulk validation fills address and PIN code from coordinates', async () => {
  const service = createService({
    geocode: async () => ({
      address: 'Sushant Apartments, Gurgaon, Haryana 122001',
      city: 'Gurgaon',
      area: 'Sushant Lok',
      pinCode: '122001',
    }),
  });
  const result = await service.validate('inventory', [{
    categoryGroup: 'A3 Screens',
    subCategory: 'Residential',
    title: 'Sushant Lok Screen Network',
    city: 'Gurgaon',
    locality: 'Sushant Lok',
    propertyName: 'Sushant Apartments',
    screenSize: '32 inch LED TV',
    numberOfScreens: '4',
    households: '202',
    approxReach: '898',
    monthlyImpressions: '26670',
    latitude: '28.459046',
    longitude: '77.080014',
    monthlyAdBudget: '14000',
    internalCost: '9100',
    sellingPrice: '12500',
    mediaSiteId: 'MS-A3-001',
    propertyType: 'RESIDENTIAL',
    nccsClass: 'A3',
  }]);

  assert.equal(result.validRows, 1);
  assert.equal(
    (result.rows[0].data.location as { address: string }).address,
    'Sushant Apartments, Gurgaon, Haryana 122001',
  );
  assert.equal(result.rows[0].data.pinCode, '122001');
  assert.equal(result.warnings.length, 2);
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
