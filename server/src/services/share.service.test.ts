import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';

import { ShareService } from './share.service.js';
import type { IPlanRepository } from '../repositories/plan.repository.js';
import type { IShareRepository } from '../repositories/share.repository.js';
import type { IPlanService } from './plan.service.js';

const service = ({
  shares = {},
  plans = {},
  planService = {},
}: {
  shares?: Partial<IShareRepository>;
  plans?: Partial<IPlanRepository>;
  planService?: Partial<IPlanService>;
}) =>
  new ShareService(
    shares as IShareRepository,
    plans as IPlanRepository,
    planService as IPlanService,
  );

test('public share output is client-safe and records an open', async () => {
  const shareId = new Types.ObjectId();
  let recorded = false;
  const shareService = service({
    shares: {
      findByTokenPopulated: async () =>
        ({
          _id: shareId,
          token: 'a'.repeat(48),
          status: 'active',
          viewCount: 4,
          plan: {
            campaign: {
              title: 'Campaign',
              brief: 'Brief',
              client: { name: 'Client' },
            },
            versionLabel: 'v1',
            status: 'Shared',
            clientNotes: 'Visible',
            internalNotes: 'SECRET_NOTE',
            items: [
              {
                inventory: new Types.ObjectId(),
                inventoryCode: 'OUT-BLR-KOR-0001',
                title: 'Site',
                categoryGroup: 'Outdoor',
                subCategory: 'Hoarding',
                city: 'Bengaluru',
                area: 'Koramangala',
                location: {
                  address: '80 Feet Road',
                  latitude: 12.9352,
                  longitude: 77.6245,
                },
                photos: ['https://example.com/site.jpg'],
                quantity: 1,
                unitSellingPrice: 500000,
                totalSellingPrice: 500000,
                unitInternalCost: 350000,
                marginAmount: 150000,
              },
            ],
            pricing: {
              subtotal: 500000,
              taxPercentage: 18,
              taxAmount: 90000,
              grandTotal: 590000,
              internalCostTotal: 350000,
              marginAmount: 150000,
            },
          },
        }) as never,
      recordView: async () => {
        recorded = true;
      },
    },
  });

  const result = await shareService.getPublic('a'.repeat(48));
  const serialized = JSON.stringify(result);

  assert.equal(recorded, true);
  assert.equal(serialized.includes('SECRET_NOTE'), false);
  assert.equal(serialized.includes('unitInternalCost'), false);
  assert.equal(serialized.includes('marginAmount'), false);
  assert.match(serialized, /unitSellingPrice/);
  assert.match(serialized, /"mapItems"/);
  assert.match(serialized, /80 Feet Road/);
  assert.match(serialized, /"viewCount":5/);
});

test('expired shares return 410 and persist expired status', async () => {
  let saved = false;
  const share = {
    _id: new Types.ObjectId(),
    token: 'b'.repeat(48),
    status: 'active',
    expiresAt: new Date(Date.now() - 1000),
  };
  const shareService = service({
    shares: {
      findByTokenPopulated: async () => share as never,
      save: async (document) => {
        saved = true;
        return document;
      },
    },
  });

  await assert.rejects(
    () => shareService.getPublic('b'.repeat(48)),
    (error: Error & { statusCode?: number }) =>
      error.statusCode === 410 && /expired/.test(error.message),
  );
  assert.equal(share.status, 'expired');
  assert.equal(saved, true);
});

test('creating a share from a draft locks it through the Plan service', async () => {
  const planId = new Types.ObjectId();
  const campaignId = new Types.ObjectId();
  const actorId = new Types.ObjectId();
  let statusUpdated = false;
  let lookupCount = 0;
  const populatedPlan = {
    _id: planId,
    status: 'Shared',
    isLocked: true,
    versionLabel: 'v1',
    campaign: {
      _id: campaignId,
      campaignCode: 'CMP-2026-0001',
      client: { name: 'Client' },
    },
  };
  const createdShare = {
    _id: new Types.ObjectId(),
    plan: planId,
    campaign: campaignId,
    token: 'c'.repeat(48),
    status: 'active',
    viewCount: 0,
    channel: 'Other',
    createdAt: new Date(),
  };
  const shareService = service({
    plans: {
      findByIdPopulated: async () => {
        lookupCount += 1;
        return (lookupCount === 1
          ? { ...populatedPlan, status: 'Draft', isLocked: false }
          : populatedPlan) as never;
      },
    },
    planService: {
      updateStatus: async () => {
        statusUpdated = true;
        return {};
      },
    },
    shares: {
      create: async () => createdShare as never,
      findByIdPopulated: async () => createdShare as never,
    },
  });

  await shareService.create(planId.toString(), {}, actorId.toString());
  assert.equal(statusUpdated, true);
});

test('map interaction tracking records opens and client-safe pin labels', async () => {
  const shareId = new Types.ObjectId();
  let opened = false;
  let clickedPin: { inventoryCode?: string; title?: string } | undefined;
  const activeShare = {
    _id: shareId,
    status: 'active',
  };
  const shareService = service({
    shares: {
      findByTokenPopulated: async () => activeShare as never,
      recordMapOpened: async () => {
        opened = true;
      },
      recordPinClick: async (_id, pin) => {
        clickedPin = pin;
      },
    },
  });

  await shareService.trackPublic('d'.repeat(48), { eventType: 'map_opened' });
  await shareService.trackPublic('d'.repeat(48), {
    eventType: 'pin_clicked',
    inventoryCode: 'OUT-BLR-KOR-0001',
    title: 'Koramangala Hoarding',
  });

  assert.equal(opened, true);
  assert.equal(clickedPin?.inventoryCode, 'OUT-BLR-KOR-0001');
  assert.equal(clickedPin?.title, 'Koramangala Hoarding');
});

test('public map data separates transit inventory from Outdoor pins', async () => {
  const shareService = service({
    shares: {
      findByTokenPopulated: async () =>
        ({
          _id: new Types.ObjectId(),
          status: 'active',
          viewCount: 0,
          plan: {
            campaign: { title: 'Campaign', client: { name: 'Client' } },
            versionLabel: 'v1',
            status: 'Shared',
            items: [
              {
                inventory: new Types.ObjectId(),
                inventoryCode: 'BUS-BLR-001',
                title: 'Airport Route Bus',
                categoryGroup: 'Bus',
                route: 'Airport - CBD',
                depot: 'Hebbal',
                quantity: 2,
                unitSellingPrice: 100000,
                totalSellingPrice: 200000,
              },
            ],
            pricing: {},
          },
        }) as never,
      recordView: async () => undefined,
    },
  });

  const result = (await shareService.getPublic('e'.repeat(48))) as {
    mapItems: unknown[];
    nonMapItems: Array<{ route?: string; depot?: string }>;
  };
  assert.equal(result.mapItems.length, 0);
  assert.equal(result.nonMapItems.length, 1);
  assert.equal(result.nonMapItems[0].route, 'Airport - CBD');
  assert.equal(result.nonMapItems[0].depot, 'Hebbal');
});
