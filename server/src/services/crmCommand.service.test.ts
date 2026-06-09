import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import type { IActivityService } from './activity.service.js';
import { CrmCommandService } from './crmCommand.service.js';
import type { ICrmService } from './crm.service.js';

const actor = {
  userId: '000000000000000000000001',
  email: 'admin@conektads.com',
  name: 'Admin',
  role: 'admin',
} as const;

test('CRM update rejects a stale record before mutation', async () => {
  let updated = false;
  const commands = new CrmCommandService(
    {
      getEntityById: async () => ({
        id: '000000000000000000000010',
        entityType: 'Brand',
        name: 'Brand',
        status: 'active',
        tags: [],
        files: [],
        updatedAt: new Date('2026-06-10T09:00:00.000Z'),
      }),
      updateEntity: async () => {
        updated = true;
        return {} as never;
      },
    } as ICrmService,
    {} as IActivityService,
  );

  await assert.rejects(
    () =>
      commands.updateEntity(
        '000000000000000000000010',
        {
          expectedUpdatedAt: '2026-06-09T09:00:00.000Z',
          phone: '+91 9000000000',
        },
        actor,
      ),
    /CRM record changed since it was read/,
  );
  assert.equal(updated, false);
});

test('CRM creation attributes the actor and writes an audit record', async () => {
  let mutation: Record<string, unknown> | undefined;
  let audit: Record<string, unknown> | undefined;
  const commands = new CrmCommandService(
    {
      createEntity: async (input) => {
        mutation = input as Record<string, unknown>;
        return {
          id: '000000000000000000000010',
          entityType: 'Brand',
          name: 'Brand',
          status: 'active',
          tags: [],
          files: [],
        };
      },
    } as ICrmService,
    {
      logEntityActivity: async (input) => {
        audit = input as unknown as Record<string, unknown>;
      },
    } as IActivityService,
  );

  await commands.createEntity(
    { entityType: 'Brand', name: 'Brand' },
    actor,
  );
  assert.equal(mutation?.createdBy, actor.userId);
  assert.equal(mutation?.updatedBy, actor.userId);
  assert.equal(audit?.action, 'CRM_CREATED');
});
