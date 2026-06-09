import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import { DashboardService } from './dashboard.service.js';

const repository = (items: any[]) => ({
  find: async () => items,
  findAll: async () => items,
});

test('dashboard overview calculates work, pipeline, inventory, share, and operation metrics', async () => {
  const userId = 'user-1';
  const now = new Date();
  const due = new Date(now);
  due.setHours(12, 0, 0, 0);
  const stale = new Date(now);
  stale.setDate(stale.getDate() - 45);
  const overdue = new Date(now);
  overdue.setDate(overdue.getDate() - 2);

  const campaigns = [
    {
      _id: 'campaign-1',
      campaignCode: 'CMP-001',
      title: 'Open Campaign',
      ownerUser: userId,
      status: 'New',
      priority: 'High',
      expectedRevenue: 500000,
      budget: { fixed: 400000 },
      nextFollowUpAt: due,
      createdAt: now,
    },
    {
      _id: 'campaign-2',
      campaignCode: 'CMP-002',
      title: 'Won Campaign',
      ownerUser: 'user-2',
      status: 'Won',
      budget: { fixed: 300000 },
      createdAt: now,
    },
    {
      _id: 'campaign-3',
      campaignCode: 'CMP-003',
      title: 'Lost Campaign',
      ownerUser: 'user-2',
      status: 'Lost',
      budget: { max: 200000 },
      createdAt: now,
    },
  ];
  const plans = [
    {
      _id: 'plan-1',
      campaign: 'campaign-1',
      createdBy: userId,
      title: 'Draft Plan',
      versionLabel: 'v1',
      status: 'Draft',
      pricing: { grandTotal: 100000 },
      createdAt: now,
    },
    {
      _id: 'plan-2',
      campaign: 'campaign-1',
      createdBy: userId,
      title: 'Shared Plan',
      versionLabel: 'v2',
      status: 'Shared',
      pricing: { grandTotal: 250000 },
      sharedAt: now,
      updatedAt: now,
    },
    {
      _id: 'plan-3',
      campaign: 'campaign-2',
      createdBy: 'user-2',
      title: 'Won Plan',
      versionLabel: 'v1',
      status: 'Won',
      pricing: { grandTotal: 300000 },
      updatedAt: now,
    },
  ];
  const inventory = [
    {
      _id: 'inventory-1',
      inventoryCode: 'OOH-001',
      title: 'Fresh Site',
      categoryGroup: 'Outdoor',
      city: 'Bengaluru',
      area: 'CBD',
      status: 'active',
      availabilityStatus: 'available',
      lastConfirmedAt: now,
    },
    {
      _id: 'inventory-2',
      inventoryCode: 'BUS-001',
      title: 'Stale Bus',
      categoryGroup: 'Bus',
      city: 'Bengaluru',
      area: 'ORR',
      status: 'active',
      availabilityStatus: 'hold',
      lastConfirmedAt: stale,
    },
    {
      _id: 'inventory-3',
      inventoryCode: 'AUTO-001',
      title: 'Never Confirmed Auto',
      categoryGroup: 'Auto',
      city: 'Bengaluru',
      area: 'HSR',
      status: 'active',
      availabilityStatus: 'booked',
    },
  ];
  const operations = [
    {
      _id: 'operation-1',
      operationCode: 'OPS-001',
      campaignTitle: 'Open Campaign',
      operationOwner: userId,
      status: 'In Progress',
      items: [
        {
          _id: 'item-1',
          inventoryCode: 'OOH-001',
          title: 'Fresh Site',
          city: 'Bengaluru',
          area: 'CBD',
          creative: { required: true, received: false },
          purchaseOrder: { required: true, sent: false },
          mounting: { scheduledDate: overdue, completed: false },
          proof: { uploaded: false },
        },
        {
          _id: 'item-2',
          inventoryCode: 'BUS-001',
          title: 'Stale Bus',
          city: 'Bengaluru',
          area: 'ORR',
          creative: { required: true, received: true },
          purchaseOrder: { required: true, sent: true },
          mounting: { completed: true },
          proof: { uploaded: false },
        },
      ],
      overallProgress: { percentage: 0 },
      updatedAt: now,
    },
  ];
  const shares = [
    {
      _id: 'share-1',
      plan: 'plan-2',
      campaign: 'campaign-1',
      status: 'active',
      channel: 'Email',
      viewCount: 7,
      metadata: { campaignCode: 'CMP-001', planVersionLabel: 'v2' },
    },
  ];
  const documents = [
    {
      _id: 'document-1',
      documentType: 'WorkOrder',
      generatedAt: now,
      metadata: { campaignCode: 'CMP-001' },
    },
  ];

  const service = new DashboardService(
    repository(campaigns) as never,
    repository(plans) as never,
    repository(inventory) as never,
    repository(operations) as never,
    repository(shares) as never,
    repository(documents) as never,
  );

  const result = (await service.overview(userId)) as any;

  assert.equal(result.myWork.myOpenCampaigns, 1);
  assert.equal(result.myWork.myFollowUpsDueToday, 1);
  assert.equal(result.myWork.myDraftPlans, 1);
  assert.equal(result.myWork.mySharedPlans, 1);
  assert.equal(result.myWork.myOperationsPending, 1);
  assert.equal(result.myWork.myProofPending, 1);
  assert.equal(result.campaigns.openPipelineValue, 500000);
  assert.equal(result.campaigns.wonValue, 300000);
  assert.equal(result.campaigns.lostValue, 200000);
  assert.equal(result.plans.totalSharedValue, 250000);
  assert.equal(result.plans.totalWonPlanValue, 300000);
  assert.equal(result.plans.topViewedShares[0].viewCount, 7);
  assert.equal('token' in result.plans.topViewedShares[0], false);
  assert.equal(result.inventory.freshInventory, 1);
  assert.equal(result.inventory.staleInventory, 1);
  assert.equal(result.inventory.neverConfirmedInventory, 1);
  assert.equal(result.inventory.needsConfirmation.length, 2);
  assert.equal(result.operations.overdueMountings, 1);
  assert.equal(result.operations.proofPending, 1);
  assert.equal(result.operations.creativePending, 1);
  assert.equal(result.operations.poPending, 1);
  assert.equal(result.recentActivity.length > 0, true);
});
