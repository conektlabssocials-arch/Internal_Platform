import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';

import { CampaignService } from './campaign.service.js';
import type { ICampaignCounterRepository } from '../repositories/campaignCounter.repository.js';
import type { ICampaignRepository } from '../repositories/campaign.repository.js';
import type { ICrmEntityRepository } from '../repositories/crmEntity.repository.js';
import type { IUserRepository } from '../repositories/user.repository.js';

const service = ({
  campaigns = {},
  counters = {},
  crm = {},
  users = {},
}: {
  campaigns?: Partial<ICampaignRepository>;
  counters?: Partial<ICampaignCounterRepository>;
  crm?: Partial<ICrmEntityRepository>;
  users?: Partial<IUserRepository>;
}) =>
  new CampaignService(
    campaigns as ICampaignRepository,
    counters as ICampaignCounterRepository,
    crm as ICrmEntityRepository,
    users as IUserRepository,
  );

test('campaign preview does not increment the yearly counter', async () => {
  let incremented = false;
  const currentYear = new Date().getFullYear();
  const campaignService = service({
    counters: {
      findByKey: async () => ({ sequence: 4 }) as never,
      incrementSequence: async () => {
        incremented = true;
        return {} as never;
      },
    },
  });

  assert.equal(await campaignService.previewCode(), `CMP-${currentYear}-0005`);
  assert.equal(incremented, false);
});

test('SupplierOwner cannot be selected as a campaign client', async () => {
  const clientId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const campaignService = service({
    crm: {
      findById: async () =>
        ({ _id: clientId, entityType: 'SupplierOwner', name: 'Owner' }) as never,
    },
    users: {
      findById: async () =>
        ({ _id: userId, name: 'User', status: 'active' }) as never,
    },
  });

  await assert.rejects(
    () =>
      campaignService.createCampaign({
        title: 'Test',
        client: clientId.toString(),
        source: 'Call',
        brief: 'Test brief',
        ownerUser: userId.toString(),
        createdBy: userId.toString(),
        updatedBy: userId.toString(),
      }),
    /cannot be used as a campaign client/,
  );
});

test('Lost status requires a reason', async () => {
  const campaignId = new Types.ObjectId();
  const campaignService = service({
    campaigns: {
      findById: async () =>
        ({
          _id: campaignId,
          status: 'New',
          save: async () => undefined,
        }) as never,
    },
  });

  await assert.rejects(
    () =>
      campaignService.updateStatus(campaignId.toString(), {
        status: 'Lost',
        updatedBy: new Types.ObjectId().toString(),
      }),
    /Lost reason is required/,
  );
});

test('campaign summary calculates open and won values', async () => {
  const campaignService = service({
    campaigns: {
      findAll: async () =>
        [
          { status: 'New', expectedRevenue: 500000 },
          { status: 'In Discussion', budget: { max: 800000 } },
          { status: 'Won', budget: { fixed: 300000 } },
          { status: 'Lost', expectedRevenue: 900000 },
        ] as never,
    },
  });

  const summary = (await campaignService.getSummary()) as {
    openPipelineValue: number;
    wonValue: number;
  };
  assert.equal(summary.openPipelineValue, 1300000);
  assert.equal(summary.wonValue, 300000);
});
