import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import type { IActivityService } from './activity.service.js';
import { InventoryCommandService } from './inventoryCommand.service.js';
import type { IInventoryService } from './inventory.service.js';
import type { IPlatformSettingsService } from './platformSettings.service.js';
import { HttpError } from '../utils/httpError.js';

const inventory = {
  id: '000000000000000000000010',
  inventoryCode: 'OUT-BLR-CBD-0001',
  categoryGroup: 'Outdoor',
  subCategory: 'Hoarding',
  title: 'MG Road',
  city: 'Bengaluru',
  area: 'CBD',
  photos: [],
  availabilityStatus: 'unknown',
  status: 'active',
  tags: [],
  confirmationStatus: 'stale',
  updatedAt: new Date('2026-06-10T09:00:00.000Z'),
} as const;

const admin = {
  userId: '000000000000000000000001',
  email: 'admin@conektads.com',
  name: 'Admin',
  role: 'admin',
} as const;

test('inventory creation attributes the actor and audits the generated code', async () => {
  let mutation: Record<string, unknown> | undefined;
  let audit: Record<string, unknown> | undefined;
  const commands = new InventoryCommandService(
    {
      createInventory: async (input) => {
        mutation = input as Record<string, unknown>;
        return {
          ...inventory,
          confirmationStatus: 'never_confirmed',
        };
      },
    } as unknown as IInventoryService,
    {
      logEntityActivity: async (input) => {
        audit = input as unknown as Record<string, unknown>;
      },
    } as IActivityService,
    {
      hasPermission: async () => true,
    } as unknown as IPlatformSettingsService,
  );

  const result = await commands.create(
    {
      categoryGroup: 'Outdoor',
      subCategory: 'Hoarding',
      title: 'MG Road',
      city: 'Bengaluru',
      area: 'CBD',
      width: 40,
      height: 20,
      location: {
        latitude: 12.975,
        longitude: 77.606,
        address: 'MG Road, Bengaluru',
        source: 'manual',
      },
      availabilityStatus: 'unknown',
    },
    admin,
  );

  assert.equal(result.inventoryCode, inventory.inventoryCode);
  assert.equal(mutation?.createdBy, admin.userId);
  assert.equal(mutation?.updatedBy, admin.userId);
  assert.equal(mutation?.status, undefined);
  assert.equal(audit?.action, 'INVENTORY_CREATED');
  assert.equal(audit?.entityCode, inventory.inventoryCode);
  assert.deepEqual(audit?.actor, admin);
});

test('inventory creation respects the member platform permission', async () => {
  let created = false;
  const commands = new InventoryCommandService(
    {
      createInventory: async () => {
        created = true;
        return inventory;
      },
    } as unknown as IInventoryService,
    {
      logEntityActivity: async () => undefined,
    } as IActivityService,
    {
      hasPermission: async () => false,
    } as unknown as IPlatformSettingsService,
  );

  await assert.rejects(
    commands.create(
      {
        categoryGroup: 'Outdoor',
        subCategory: 'Hoarding',
        title: 'MG Road',
        city: 'Bengaluru',
        area: 'CBD',
      },
      { ...admin, role: 'member' },
    ),
    (error: unknown) =>
      error instanceof HttpError
      && error.statusCode === 403,
  );
  assert.equal(created, false);
});

test('inventory confirmation rejects a stale item before changing prices', async () => {
  let confirmed = false;
  const commands = new InventoryCommandService(
    {
      getInventoryById: async () => inventory,
      confirmInventory: async () => {
        confirmed = true;
        return inventory;
      },
    } as unknown as IInventoryService,
    {} as IActivityService,
    {} as IPlatformSettingsService,
  );

  await assert.rejects(
    () =>
      commands.confirm(
        inventory.id,
        {
          expectedUpdatedAt: '2026-06-09T09:00:00.000Z',
          availabilityStatus: 'available',
          sellingPrice: 500000,
        },
        admin,
      ),
    /Inventory changed since it was read/,
  );
  assert.equal(confirmed, false);
});

test('member cannot activate or deactivate inventory through the command', async () => {
  const commands = new InventoryCommandService(
    {} as IInventoryService,
    {} as IActivityService,
    {} as IPlatformSettingsService,
  );
  await assert.rejects(
    () =>
      commands.changeStatus(
        inventory.id,
        'active',
        inventory.updatedAt.toISOString(),
        'inactive',
        { ...admin, role: 'member' },
      ),
    /Admin access required/,
  );
});
