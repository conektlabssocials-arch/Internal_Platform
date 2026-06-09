import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import type { IActivityService } from './activity.service.js';
import type { ICampaignService } from './campaign.service.js';
import { PlanAuthoringCommandService } from './planAuthoringCommand.service.js';
import type { IPlanService } from './plan.service.js';

const actor = {
  userId: '000000000000000000000001',
  email: 'admin@conektads.com',
  name: 'Admin',
  role: 'admin',
} as const;

const plan = {
  id: '000000000000000000000010',
  campaign: {
    id: '000000000000000000000020',
    campaignCode: 'CMP-2026-0010',
  },
  versionLabel: 'v1',
  title: 'Bangalore Launch - Plan v1',
  status: 'Draft',
  isLocked: false,
  items: [],
  pricing: {},
  updatedAt: new Date('2026-06-10T09:00:00.000Z'),
};

test('draft update rejects a stale plan before changing pricing or items', async () => {
  let updated = false;
  const service = new PlanAuthoringCommandService(
    {
      getById: async () => plan,
      update: async () => {
        updated = true;
        return plan;
      },
    } as unknown as IPlanService,
    {} as ICampaignService,
    {} as IActivityService,
  );

  await assert.rejects(
    () =>
      service.update(
        plan.id,
        {
          expectedUpdatedAt: '2026-06-09T09:00:00.000Z',
          taxPercentage: 18,
        },
        actor,
      ),
    /Plan changed since it was read/,
  );
  assert.equal(updated, false);
});

test('plan creation attributes the actor and records the standard audit event', async () => {
  let mutation: Record<string, unknown> | undefined;
  let audit: Record<string, unknown> | undefined;
  const service = new PlanAuthoringCommandService(
    {
      create: async (_campaignId, input) => {
        mutation = input as Record<string, unknown>;
        return plan;
      },
    } as unknown as IPlanService,
    {
      getCampaignById: async () => ({
        id: plan.campaign.id,
        campaignCode: plan.campaign.campaignCode,
        status: 'In Discussion',
        updatedAt: new Date('2026-06-10T08:00:00.000Z'),
      }),
    } as ICampaignService,
    {
      logEntityActivity: async (input) => {
        audit = input as unknown as Record<string, unknown>;
      },
    } as IActivityService,
  );

  await service.create(
    plan.campaign.id,
    {
      expectedCampaignStatus: 'In Discussion',
      expectedCampaignUpdatedAt: '2026-06-10T08:00:00.000Z',
      items: [
        {
          inventory: '000000000000000000000030',
          quantity: 1,
          unitSellingPrice: 500000,
          unitInternalCost: 350000,
        },
      ],
    },
    actor,
  );

  assert.equal(mutation?.createdBy, actor.userId);
  assert.equal(mutation?.updatedBy, actor.userId);
  assert.equal(audit?.action, 'PLAN_CREATED');
  assert.deepEqual(audit?.actor, actor);
});
