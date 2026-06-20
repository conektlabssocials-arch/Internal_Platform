import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';

import type { IContactRepository } from '../repositories/contact.repository.js';
import type { ICrmEntityRepository } from '../repositories/crmEntity.repository.js';
import type { IInventoryRepository } from '../repositories/inventory.repository.js';
import type { IGeocodingService } from './geocoding.service.js';
import { ImportValidatorsService } from './importValidators.service.js';

// Keep the sequential Nominatim rate-limit delay out of the test runtime.
process.env.IMPORT_GEOCODE_DELAY_MS = '0';

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

test('Outdoor validation fills area and address from coordinates', async () => {
  let geocodeCalls = 0;
  const service = createService({
    geocode: async () => {
      geocodeCalls += 1;
      return {
        address: 'SH1, Kamalapura, Dharwad, Karnataka, 580001, India',
        city: 'Dharwad',
        area: 'Kamalapura',
        pinCode: '580001',
      };
    },
  });

  const result = await service.validate('inventory', [
    {
      categoryGroup: 'Outdoor',
      subCategory: 'Hoarding',
      title: 'Highway Hoarding',
      width: '20',
      height: '10',
      latitude: '15.4609',
      longitude: '75.0114',
    },
  ]);

  assert.equal(geocodeCalls, 1);
  assert.equal(result.validRows, 1);
  assert.equal(result.rows[0].data.area, 'Kamalapura');
  assert.equal(result.rows[0].data.city, 'Dharwad');
  assert.equal(
    (result.rows[0].data.location as { address: string }).address,
    'SH1, Kamalapura, Dharwad, Karnataka, 580001, India',
  );
  assert.equal(
    result.warnings.some(
      (warning) => warning.field === 'area' && warning.message.includes('latitude and longitude'),
    ),
    true,
  );
  assert.equal(
    result.warnings.some(
      (warning) => warning.field === 'address' && warning.message.includes('latitude and longitude'),
    ),
    true,
  );
});

test('large Outdoor imports (>5 rows) still geocode area and address from coordinates', async () => {
  let geocodeCalls = 0;
  const service = createService({
    geocode: async () => {
      geocodeCalls += 1;
      return { address: 'MG Road, Indiranagar, Bengaluru', city: 'Bengaluru', area: 'Indiranagar' };
    },
  });

  const result = await service.validate(
    'inventory',
    Array.from({ length: 8 }, (_, index) => ({
      categoryGroup: 'Outdoor',
      subCategory: 'Hoarding',
      title: `Hoarding ${index + 1}`,
      width: '20',
      height: '10',
      // Distinct coordinates so each row is a unique geocode lookup.
      latitude: String(12.97 + index * 0.001),
      longitude: '77.64',
    })),
  );

  assert.equal(geocodeCalls, 8);
  assert.equal(result.validRows, 8);
  assert.equal(result.rows[0].data.area, 'Indiranagar');
  assert.equal(
    (result.rows[0].data.location as { address: string }).address,
    'MG Road, Indiranagar, Bengaluru',
  );
});

test('Outdoor validation defaults area and address to NA when coordinates cannot be resolved', async () => {
  const service = createService({ geocode: async () => ({}) });
  const result = await service.validate('inventory', [
    {
      categoryGroup: 'Outdoor',
      subCategory: 'Hoarding',
      title: 'Highway Hoarding',
      city: 'Hubli',
      width: '20',
      height: '10',
      latitude: '15.4609',
      longitude: '75.0114',
    },
  ]);

  assert.equal(result.validRows, 1);
  assert.equal(result.rows[0].data.area, 'NA');
  assert.equal((result.rows[0].data.location as { address: string }).address, 'NA');
  assert.equal(
    result.warnings.some(
      (warning) => warning.field === 'area' && warning.message.includes('defaulted to NA'),
    ),
    true,
  );
});

test('Outdoor validation still requires city when it cannot be resolved', async () => {
  const service = createService({ geocode: async () => ({}) });
  const result = await service.validate('inventory', [
    {
      categoryGroup: 'Outdoor',
      subCategory: 'Hoarding',
      title: 'Highway Hoarding',
      width: '20',
      height: '10',
      latitude: '15.4609',
      longitude: '75.0114',
    },
  ]);

  assert.equal(result.invalidRows, 1);
  assert.equal(result.errors.some((error) => error.field === 'city'), true);
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
      width: '3',
      height: '2',
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
  assert.equal(result.rows[0].data.width, 3);
  assert.equal(result.rows[0].data.height, 2);
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
    width: '3',
    height: '2',
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

test('large A3 imports use address fallback when geocoding returns nothing', async () => {
  const service = createService({
    geocode: async () => ({}),
  });
  const baseRow = {
    categoryGroup: 'A3 Screens',
    subCategory: 'Residential',
    title: 'Residency Screen Network',
    city: 'Gurgaon',
    locality: 'Sector 43',
    propertyName: 'Residency One',
    screenSize: '32 inch LED TV',
    numberOfScreens: '4',
    households: '200',
    approxReach: '800',
    monthlyImpressions: '24000',
    latitude: '28.459046',
    longitude: '77.080014',
    monthlyAdBudget: '14000',
    internalCost: '9100',
    sellingPrice: '12500',
    mediaSiteId: 'A3-GGN',
    propertyType: 'RESIDENTIAL',
    nccsClass: 'A3',
  };
  const result = await service.validate(
    'inventory',
    Array.from({ length: 6 }, (_, index) => ({
      ...baseRow,
      title: `${baseRow.title} ${index + 1}`,
      propertyName: `${baseRow.propertyName} ${index + 1}`,
      mediaSiteId: `${baseRow.mediaSiteId}-${index + 1}`,
      latitude: String(Number(baseRow.latitude) + index * 0.001),
    })),
  );

  assert.equal(result.validRows, 6);
  assert.equal(
    (result.rows[0].data.location as { address?: string }).address,
    'Residency One 1, Sector 43, Gurgaon',
  );
  assert.equal(result.rows[0].data.pinCode, undefined);
  assert.equal(
    result.warnings.some(
      (warning) =>
        warning.field === 'pinCode' &&
        warning.message.includes('could not be resolved automatically'),
    ),
    true,
  );
});

test('A3 Screens calculates width and height from screen size', async () => {
  const service = createService();
  const result = await service.validate('inventory', [{
    categoryGroup: 'A3 Screens',
    subCategory: 'Residential',
    title: 'Residency Screen Network',
    city: 'Bangalore',
    locality: 'Indiranagar',
    propertyName: 'Residency One',
    pinCode: '560038',
    screenSize: '32 inch LED TV',
    numberOfScreens: '6',
    households: '180',
    approxReach: '720',
    monthlyImpressions: '21000',
    address: 'Residency One, Indiranagar, Bangalore',
    latitude: '12.9784',
    longitude: '77.6408',
    monthlyAdBudget: '12000',
    internalCost: '9000',
    sellingPrice: '12500',
    mediaSiteId: 'A3-BLR-001',
    propertyType: 'RESIDENTIAL',
    nccsClass: 'A3',
  }]);

  assert.equal(result.validRows, 1);
  assert.equal(result.rows[0].data.screenSize, '32 inch LED TV');
  assert.equal(result.rows[0].data.width, 2.32);
  assert.equal(result.rows[0].data.height, 1.31);
  assert.equal(result.rows[0].data.totalSqFt, 3.0392);
});

test('A3 Screens calculates height and screen size from width', async () => {
  const service = createService();
  const result = await service.validate('inventory', [{
    categoryGroup: 'A3 Screens',
    subCategory: 'Corporate',
    title: 'Corporate Screen Network',
    city: 'Bangalore',
    locality: 'Whitefield',
    propertyName: 'Corporate Tower',
    pinCode: '560066',
    width: '2.32',
    numberOfScreens: '8',
    households: '300',
    approxReach: '1200',
    monthlyImpressions: '36000',
    address: 'Corporate Tower, Whitefield, Bangalore',
    latitude: '12.9698',
    longitude: '77.7500',
    monthlyAdBudget: '18000',
    internalCost: '12000',
    sellingPrice: '18000',
    mediaSiteId: 'A3-BLR-002',
    propertyType: 'CORPORATE',
    nccsClass: 'A3',
  }]);

  assert.equal(result.validRows, 1);
  assert.equal(result.rows[0].data.width, 2.32);
  assert.equal(result.rows[0].data.height, 1.31);
  assert.equal(result.rows[0].data.screenSize, '31.9 inch LED TV');
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
