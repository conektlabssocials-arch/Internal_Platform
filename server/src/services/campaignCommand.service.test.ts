import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import type { CampaignDto } from '../dto/campaign.dto.js';
import type { IActivityService } from './activity.service.js';
import type { ICampaignService } from './campaign.service.js';
import type { ICrmService } from './crm.service.js';
import { CampaignCommandService } from './campaignCommand.service.js';

const actor = {
  userId: '000000000000000000000001',
  email: 'admin@conektads.com',
  name: 'Admin',
  role: 'admin',
};

const campaign = (overrides: Partial<CampaignDto> = {}): CampaignDto => ({
  id: '000000000000000000000010',
  campaignCode: 'CMP-2026-0010',
  title: 'Bangalore Launch',
  client: { id: '000000000000000000000020', name: 'Client' },
  clientType: 'Brand',
  source: 'Call',
  brief: 'Campaign brief',
  budgetType: 'unknown',
  geos: ['Bangalore'],
  categoriesOfInterest: ['Outdoor'],
  ownerUser: {
    id: actor.userId,
    name: actor.name,
    email: actor.email,
    role: actor.role,
  },
  status: 'New',
  priority: 'Medium',
  tags: [],
  ...overrides,
});

test('campaign follow-up command writes actor attribution and an audit record', async () => {
  const before = campaign({
    nextFollowUpAt: new Date('2026-06-10T09:00:00.000Z'),
  });
  const after = campaign({
    nextFollowUpAt: new Date('2026-06-12T09:00:00.000Z'),
  });
  let mutation: Record<string, unknown> | undefined;
  let audit: Record<string, unknown> | undefined;
  const campaigns = {
    getCampaignById: async () => before,
    updateCampaign: async (_id: string, input: Record<string, unknown>) => {
      mutation = input;
      return after;
    },
  } as unknown as ICampaignService;
  const activity = {
    logEntityActivity: async (input: Record<string, unknown>) => {
      audit = input;
    },
  } as unknown as IActivityService;
  const commands = new CampaignCommandService(campaigns, activity);

  const result = await commands.updateFollowUp(
    before.id,
    {
      nextFollowUpAt: '2026-06-12T09:00:00.000Z',
      expectedCurrentFollowUpAt: '2026-06-10T09:00:00.000Z',
      followUpNote: 'Call the client about final locations',
    },
    actor,
  );

  assert.equal(result.nextFollowUpAt, after.nextFollowUpAt);
  assert.equal(mutation?.updatedBy, actor.userId);
  assert.deepEqual(mutation?.nextFollowUpAt, after.nextFollowUpAt);
  assert.equal(audit?.action, 'CAMPAIGN_FOLLOWUP_UPDATED');
  assert.deepEqual(audit?.actor, actor);
  assert.deepEqual(audit?.metadata, {
    followUpNote: 'Call the client about final locations',
  });
});

test('campaign status command rejects a stale expected status', async () => {
  let updated = false;
  const campaigns = {
    getCampaignById: async () => campaign({ status: 'Negotiating' }),
    updateStatus: async () => {
      updated = true;
      return campaign({ status: 'Won' });
    },
  } as unknown as ICampaignService;
  const commands = new CampaignCommandService(
    campaigns,
    {} as IActivityService,
    {} as ICrmService,
  );

  await assert.rejects(
    () =>
      commands.changeStatus(
        campaign().id,
        {
          expectedCurrentStatus: 'Plan Shared',
          status: 'Won',
        },
        actor,
      ),
    /status is Negotiating, not Plan Shared/,
  );
  assert.equal(updated, false);
});

test('campaign status command updates and audits a confirmed status change', async () => {
  const before = campaign({ status: 'Negotiating' });
  const after = campaign({ status: 'Won' });
  let mutation: Record<string, unknown> | undefined;
  let audit: Record<string, unknown> | undefined;
  const campaigns = {
    getCampaignById: async () => before,
    updateStatus: async (_id: string, input: Record<string, unknown>) => {
      mutation = input;
      return after;
    },
  } as unknown as ICampaignService;
  const activity = {
    logEntityActivity: async (input: Record<string, unknown>) => {
      audit = input;
    },
  } as unknown as IActivityService;
  const commands = new CampaignCommandService(campaigns, activity);

  await commands.changeStatus(
    before.id,
    {
      expectedCurrentStatus: 'Negotiating',
      status: 'Won',
      reason: 'Client approved the plan',
    },
    actor,
  );

  assert.deepEqual(mutation, {
    status: 'Won',
    reason: 'Client approved the plan',
    updatedBy: actor.userId,
  });
  assert.equal(audit?.action, 'CAMPAIGN_STATUS_CHANGED');
  assert.deepEqual(audit?.metadata, {
    statusFrom: 'Negotiating',
    statusTo: 'Won',
    reason: 'Client approved the plan',
  });
});

test('campaign creation rejects a stale CRM client', async () => {
  let created = false;
  const campaigns = {
    createCampaign: async () => {
      created = true;
      return campaign();
    },
  } as unknown as ICampaignService;
  const commands = new CampaignCommandService(
    campaigns,
    {} as IActivityService,
    {
      getEntityById: async () => ({
        id: '000000000000000000000020',
        entityType: 'Brand',
        name: 'Client',
        status: 'active',
        tags: [],
        files: [],
        updatedAt: new Date('2026-06-10T09:00:00.000Z'),
      }),
    } as ICrmService,
  );

  await assert.rejects(
    () =>
      commands.createCampaign(
        {
          client: '000000000000000000000020',
          expectedClientUpdatedAt: '2026-06-09T09:00:00.000Z',
          title: 'Campaign',
          source: 'Call',
          brief: 'Brief',
        },
        actor,
      ),
    /CRM client changed since it was read/,
  );
  assert.equal(created, false);
});
