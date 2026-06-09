import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import type { IActivityService } from './activity.service.js';
import { InventoryCommandService } from './inventoryCommand.service.js';
import type { IInventoryService } from './inventory.service.js';

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
