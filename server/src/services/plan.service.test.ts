import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';

import { PlanService } from './plan.service.js';
import type { ICampaignRepository } from '../repositories/campaign.repository.js';
import type { IInventoryRepository } from '../repositories/inventory.repository.js';
import type { IPlanRepository } from '../repositories/plan.repository.js';
import type { IOperationService } from './operation.service.js';
import { calculatePlanItem, calculatePlanPricing } from '../utils/planPricing.js';

const service = ({
  plans = {},
  campaigns = {},
  inventory = {},
  operations = {},
}: {
  plans?: Partial<IPlanRepository>;
  campaigns?: Partial<ICampaignRepository>;
  inventory?: Partial<IInventoryRepository>;
  operations?: Partial<IOperationService>;
}) =>
  new PlanService(
    plans as IPlanRepository,
    campaigns as ICampaignRepository,
    inventory as IInventoryRepository,
    operations as IOperationService,
  );

test('plan pricing calculates inclusive duration, totals, tax, and margin', () => {
  const item = calculatePlanItem({
    startDate: new Date('2026-07-01T00:00:00.000Z'),
    endDate: new Date('2026-07-30T00:00:00.000Z'),
    quantity: 2,
    unitSellingPrice: 500000,
    unitInternalCost: 350000,
  });
  const pricing = calculatePlanPricing([item], 18);

  assert.equal(item.durationDays, 30);
  assert.equal(item.totalSellingPrice, 1000000);
  assert.equal(item.totalInternalCost, 700000);
  assert.equal(pricing.taxAmount, 180000);
  assert.equal(pricing.grandTotal, 1180000);
  assert.equal(pricing.marginPercentage, 30);
});

test('stale or never-confirmed inventory cannot be added to a plan', async () => {
  const planId = new Types.ObjectId();
  const inventoryId = new Types.ObjectId();
  const planService = service({
    plans: {
      findById: async () =>
        ({
          _id: planId,
          status: 'Draft',
          isLocked: false,
          items: [],
          pricing: { taxPercentage: 0 },
        }) as never,
    },
    inventory: {
      findById: async () =>
        ({
          _id: inventoryId,
          status: 'active',
          availabilityStatus: 'available',
          lastConfirmedAt: undefined,
        }) as never,
    },
  });

  await assert.rejects(
    () =>
      planService.update(planId.toString(), {
        items: [{ inventory: inventoryId.toString() }],
      }),
    /Inventory must be confirmed before adding to a plan/,
  );
});

test('locked plans reject draft updates', async () => {
  const planId = new Types.ObjectId();
  const planService = service({
    plans: {
      findById: async () =>
        ({
          _id: planId,
          status: 'Shared',
          isLocked: true,
        }) as never,
    },
  });

  await assert.rejects(
    () => planService.update(planId.toString(), { title: 'Changed title' }),
    /This plan version is locked/,
  );
});

test('draft updates denormalize fresh inventory and recalculate pricing', async () => {
  const planId = new Types.ObjectId();
  const campaignId = new Types.ObjectId();
  const inventoryId = new Types.ObjectId();
  const actorId = new Types.ObjectId();
  const now = new Date();
  const plan = {
    _id: planId,
    campaign: campaignId,
    versionNumber: 1,
    versionLabel: 'v1',
    title: 'Original plan',
    status: 'Draft',
    isLocked: false,
    items: [],
    pricing: { taxPercentage: 0 },
    createdAt: now,
    updatedAt: now,
  };
  const planService = service({
    plans: {
      findById: async () => plan as never,
      findByIdPopulated: async () => plan as never,
      save: async (document) => document,
    },
    inventory: {
      findById: async () =>
        ({
          _id: inventoryId,
          inventoryCode: 'OOH-BLR-CBD-001',
          title: 'MG Road Hoarding',
          categoryGroup: 'Outdoor',
          subCategory: 'Hoarding',
          city: 'Bengaluru',
          area: 'MG Road',
          width: 40,
          height: 20,
          totalSqFt: 800,
          location: {
            address: 'MG Road, Bengaluru',
            latitude: 12.975,
            longitude: 77.606,
          },
          photos: ['https://example.com/site.jpg'],
          route: undefined,
          depot: undefined,
          itinerary: undefined,
          status: 'active',
          availabilityStatus: 'available',
          lastConfirmedAt: now,
        }) as never,
    },
  });

  const result = (await planService.update(planId.toString(), {
    title: 'Updated plan',
    items: [
      {
        inventory: inventoryId.toString(),
        quantity: 2,
        unitSellingPrice: 500000,
        unitInternalCost: 350000,
      },
    ],
    taxPercentage: 18,
    updatedBy: actorId.toString(),
  })) as {
    items: {
      inventoryCode: string;
      totalSellingPrice: number;
      location?: { address?: string; latitude?: number };
      photos: string[];
    }[];
    pricing: { grandTotal: number };
  };

  assert.equal(result.items[0].inventoryCode, 'OOH-BLR-CBD-001');
  assert.equal(result.items[0].totalSellingPrice, 1000000);
  assert.equal(result.items[0].location?.address, 'MG Road, Bengaluru');
  assert.equal(result.items[0].location?.latitude, 12.975);
  assert.deepEqual(result.items[0].photos, ['https://example.com/site.jpg']);
  assert.equal(result.pricing.grandTotal, 1180000);
});

test('draft updates preserve A3 property audience data in the plan snapshot', async () => {
  const planId = new Types.ObjectId();
  const campaignId = new Types.ObjectId();
  const inventoryId = new Types.ObjectId();
  const now = new Date();
  const plan = {
    _id: planId,
    campaign: campaignId,
    versionNumber: 1,
    versionLabel: 'v1',
    title: 'A3 plan',
    status: 'Draft',
    isLocked: false,
    items: [],
    pricing: { taxPercentage: 0 },
    createdAt: now,
    updatedAt: now,
  };
  const planService = service({
    plans: {
      findById: async () => plan as never,
      findByIdPopulated: async () => plan as never,
      save: async (document) => document,
    },
    inventory: {
      findById: async () =>
        ({
          _id: inventoryId,
          inventoryCode: 'A3-GUR-SLP-0001',
          title: 'Apartment Screen Network',
          categoryGroup: 'A3 Screens',
          subCategory: 'Residential',
          city: 'Gurgaon',
          area: 'Sushant Lok',
          location: {
            address: 'Sushant Lok Phase 1, Gurgaon',
            latitude: 28.459046,
            longitude: 77.080014,
          },
          screenSize: '32 inch LED TV',
          numberOfScreens: 4,
          households: 202,
          approxReach: 898,
          monthlyImpressions: 26670,
          buildingAge: 23,
          status: 'active',
          availabilityStatus: 'available',
          lastConfirmedAt: now,
        }) as never,
    },
  });

  const result = (await planService.update(planId.toString(), {
    items: [{
      inventory: inventoryId.toString(),
      quantity: 99,
      unitSellingPrice: 12500,
      unitInternalCost: 9100,
    }],
  })) as {
    items: Array<{
      location?: { address?: string };
      households?: number;
      approxReach?: number;
      monthlyImpressions?: number;
      buildingAge?: number;
      screenSize?: string;
      numberOfScreens?: number;
      quantity?: number;
      totalSellingPrice?: number;
      totalInternalCost?: number;
    }>;
  };

  assert.equal(result.items[0].location?.address, 'Sushant Lok Phase 1, Gurgaon');
  assert.equal(result.items[0].households, 202);
  assert.equal(result.items[0].approxReach, 898);
  assert.equal(result.items[0].monthlyImpressions, 26670);
  assert.equal(result.items[0].buildingAge, 23);
  assert.equal(result.items[0].screenSize, '32 inch LED TV');
  assert.equal(result.items[0].numberOfScreens, 4);
  assert.equal(result.items[0].quantity, 4);
  assert.equal(result.items[0].totalSellingPrice, 12500);
  assert.equal(result.items[0].totalInternalCost, 9100);
});

test('plan statuses cannot skip the documented workflow', async () => {
  const planId = new Types.ObjectId();
  const planService = service({
    plans: {
      findById: async () =>
        ({
          _id: planId,
          status: 'Draft',
          isLocked: false,
        }) as never,
    },
  });

  await assert.rejects(
    () =>
      planService.updateStatus(planId.toString(), {
        status: 'Won',
        actorId: new Types.ObjectId().toString(),
      }),
    /Cannot change plan status from Draft to Won/,
  );
});

test('marking a plan Won automatically creates its Operations Work Order', async () => {
  const planId = new Types.ObjectId();
  const campaignId = new Types.ObjectId();
  const actorId = new Types.ObjectId();
  let operationPlanId = '';
  const plan = {
    _id: planId,
    campaign: campaignId,
    versionNumber: 1,
    versionLabel: 'v1',
    title: 'Won Plan',
    status: 'Shared',
    isLocked: true,
    items: [],
    pricing: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const campaign = {
    _id: campaignId,
    status: 'Plan Shared',
  };
  const planService = service({
    plans: {
      findById: async () => plan as never,
      findByIdPopulated: async () => plan as never,
      save: async (document) => document,
    },
    campaigns: {
      findById: async () => campaign as never,
      save: async (document) => document,
    },
    operations: {
      createOperationFromWonPlan: async (id) => {
        operationPlanId = id;
        return {};
      },
    },
  });

  await planService.updateStatus(planId.toString(), {
    status: 'Won',
    actorId: actorId.toString(),
  });

  assert.equal(plan.status, 'Won');
  assert.equal(plan.isLocked, true);
  assert.equal(campaign.status, 'Won');
  assert.equal(operationPlanId, planId.toString());
});
