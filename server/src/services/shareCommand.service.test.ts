import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import type { IActivityService } from './activity.service.js';
import type { IPlanService } from './plan.service.js';
import type { IShareService } from './share.service.js';
import { ShareCommandService } from './shareCommand.service.js';

const actor = {
  userId: '000000000000000000000001',
  email: 'admin@conektads.com',
  name: 'Admin',
  role: 'admin',
} as const;

test('share creation rejects a stale plan before locking or sharing it', async () => {
  let created = false;
  const service = new ShareCommandService(
    {
      create: async () => {
        created = true;
        return {};
      },
    } as IShareService,
    {
      getById: async () => ({
        id: '000000000000000000000010',
        status: 'Draft',
        isLocked: false,
        updatedAt: new Date('2026-06-10T09:00:00.000Z'),
      }),
    } as IPlanService,
    {} as IActivityService,
  );

  await assert.rejects(
    () =>
      service.create(
        '000000000000000000000010',
        {
          expectedPlanStatus: 'Draft',
          expectedPlanUpdatedAt: '2026-06-09T09:00:00.000Z',
          channel: 'Email',
        },
        actor,
      ),
    /Plan changed since it was read/,
  );
  assert.equal(created, false);
});

test('share creation delegates the Draft-to-Shared workflow and audits the actor', async () => {
  let createdBy: string | undefined;
  let audit: Record<string, unknown> | undefined;
  const share = {
    id: '000000000000000000000040',
    plan: '000000000000000000000010',
    status: 'active',
    channel: 'Email',
    shareUrl: 'https://internal.conektads.com/share/plan/token',
    metadata: {
      campaignCode: 'CMP-2026-0010',
      planVersionLabel: 'v1',
    },
  };
  const service = new ShareCommandService(
    {
      create: async (_planId, _input, actorId) => {
        createdBy = actorId;
        return share;
      },
    } as IShareService,
    {
      getById: async () => ({
        id: share.plan,
        status: 'Draft',
        isLocked: false,
        updatedAt: new Date('2026-06-10T09:00:00.000Z'),
      }),
    } as IPlanService,
    {
      logEntityActivity: async (input) => {
        audit = input as unknown as Record<string, unknown>;
      },
    } as IActivityService,
  );

  const result = await service.create(
    share.plan,
    {
      expectedPlanStatus: 'Draft',
      expectedPlanUpdatedAt: '2026-06-10T09:00:00.000Z',
      channel: 'Email',
      sharedWithEmail: 'client@example.com',
    },
    actor,
  );

  assert.equal(result.shareUrl, share.shareUrl);
  assert.equal(createdBy, actor.userId);
  assert.equal(audit?.action, 'SHARE_CREATED');
});

test('disable share rejects a link that is no longer active', async () => {
  let disabled = false;
  const service = new ShareCommandService(
    {
      getById: async () => ({
        id: '000000000000000000000040',
        status: 'disabled',
      }),
      disable: async () => {
        disabled = true;
        return {};
      },
    } as IShareService,
    {} as IPlanService,
    {} as IActivityService,
  );

  await assert.rejects(
    () =>
      service.disable(
        '000000000000000000000040',
        actor,
      ),
    /already disabled/,
  );
  assert.equal(disabled, false);
});
