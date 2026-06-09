import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import type { IActivityService } from './activity.service.js';
import { OperationCommandService } from './operationCommand.service.js';
import type { IOperationService } from './operation.service.js';

const actor = {
  userId: '000000000000000000000001',
  email: 'admin@conektads.com',
  name: 'Admin',
  role: 'admin',
};

const operation = (overrides: Record<string, unknown> = {}) => ({
  id: '000000000000000000000010',
  operationCode: 'OPS-2026-0001',
  campaign: '000000000000000000000020',
  plan: '000000000000000000000030',
  campaignTitle: 'Campaign',
  status: 'In Progress',
  priority: 'Medium',
  items: [
    {
      id: '000000000000000000000040',
      inventoryCode: 'OUT-BLR-CBD-0001',
      title: 'MG Road Hoarding',
      creative: { required: true, received: true, fileUrls: [] },
      purchaseOrder: { required: true, sent: true },
      mounting: { completed: true },
      proof: { uploaded: false, photoUrls: [] },
      takedown: { required: true, completed: false },
      itemStatus: 'Mounted',
    },
  ],
  overallProgress: {},
  importantDates: {},
  updatedAt: new Date('2026-06-10T09:00:00.000Z'),
  ...overrides,
});

test('operation item command rejects a stale operation timestamp', async () => {
  let updated = false;
  const operations = {
    getById: async () => operation(),
    updateProof: async () => {
      updated = true;
      return operation();
    },
  } as unknown as IOperationService;
  const commands = new OperationCommandService(
    operations,
    {} as IActivityService,
  );

  await assert.rejects(
    () =>
      commands.updateItem(
        operation().id,
        operation().items[0].id,
        'proof',
        {
          expectedUpdatedAt: '2026-06-09T09:00:00.000Z',
          mutation: { uploaded: true },
        },
        actor,
      ),
    /Operation changed since it was read/,
  );
  assert.equal(updated, false);
});

test('operation proof command attributes actor and writes an item audit record', async () => {
  let mutation: Record<string, unknown> | undefined;
  let actorId: string | undefined;
  let audit: Record<string, unknown> | undefined;
  const before = operation();
  const after = operation({
    status: 'Completed',
    updatedAt: new Date('2026-06-10T09:01:00.000Z'),
    items: [
      {
        ...operation().items[0],
        proof: {
          uploaded: true,
          photoUrls: ['https://example.com/proof.jpg'],
        },
        itemStatus: 'Completed',
      },
    ],
  });
  const operations = {
    getById: async () => before,
    updateProof: async (
      _operationId: string,
      _itemId: string,
      input: Record<string, unknown>,
      userId: string,
    ) => {
      mutation = input;
      actorId = userId;
      return after;
    },
  } as unknown as IOperationService;
  const activity = {
    logEntityActivity: async (input: Record<string, unknown>) => {
      audit = input;
    },
  } as unknown as IActivityService;
  const commands = new OperationCommandService(operations, activity);

  await commands.updateItem(
    before.id,
    before.items[0].id,
    'proof',
    {
      expectedUpdatedAt: '2026-06-10T09:00:00.000Z',
      mutation: {
        uploaded: true,
        photoUrls: ['https://example.com/proof.jpg'],
      },
    },
    actor,
  );

  assert.deepEqual(mutation, {
    uploaded: true,
    photoUrls: ['https://example.com/proof.jpg'],
  });
  assert.equal(actorId, actor.userId);
  assert.equal(audit?.action, 'PROOF_UPDATED');
  assert.deepEqual(audit?.actor, actor);
  assert.equal(audit?.parentEntityCode, before.operationCode);
});
