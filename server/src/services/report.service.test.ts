import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import { ReportService } from './report.service.js';

const repository = (items: any[]) => ({
  find: async () => items,
  findAll: async () => items,
});

test('pipeline report calculates values, conversion, and date filtering', async () => {
  const campaigns = [
    {
      _id: 'campaign-1',
      campaignCode: 'CMP-001',
      title: 'Open',
      status: 'Negotiating',
      source: 'Email',
      clientType: 'Brand',
      priority: 'High',
      expectedRevenue: 500000,
      createdAt: new Date('2026-06-10T10:00:00.000Z'),
    },
    {
      _id: 'campaign-2',
      campaignCode: 'CMP-002',
      title: 'Won',
      status: 'Won',
      source: 'Referral',
      clientType: 'Agency',
      budget: { fixed: 300000 },
      createdAt: new Date('2026-06-11T10:00:00.000Z'),
    },
    {
      _id: 'campaign-3',
      campaignCode: 'CMP-003',
      title: 'Outside',
      status: 'Lost',
      expectedRevenue: 900000,
      createdAt: new Date('2026-05-01T10:00:00.000Z'),
    },
  ];
  const service = new ReportService(
    repository(campaigns) as never,
    repository([]) as never,
    repository([]) as never,
    repository([]) as never,
  );

  const result = (await service.pipeline({
    from: '2026-06-01',
    to: '2026-06-30',
  })) as any;

  assert.equal(result.totals.campaigns, 2);
  assert.equal(result.totals.openPipelineValue, 500000);
  assert.equal(result.totals.wonValue, 300000);
  assert.equal(result.totals.conversionRate, 100);
  assert.equal(result.topOpenOpportunities[0].campaignCode, 'CMP-001');
});

test('inventory health reports freshness and pricing coverage', async () => {
  const now = new Date();
  const stale = new Date(now);
  stale.setDate(stale.getDate() - 45);
  const inventory = [
    {
      _id: 'inventory-1',
      inventoryCode: 'OUT-001',
      title: 'Fresh',
      categoryGroup: 'Outdoor',
      city: 'Bengaluru',
      area: 'CBD',
      status: 'active',
      availabilityStatus: 'available',
      lastConfirmedAt: now,
      internalCost: 100,
      sellingPrice: 150,
      createdAt: now,
    },
    {
      _id: 'inventory-2',
      inventoryCode: 'OUT-002',
      title: 'Stale',
      categoryGroup: 'Outdoor',
      city: 'Bengaluru',
      area: 'HSR',
      status: 'active',
      availabilityStatus: 'hold',
      lastConfirmedAt: stale,
      createdAt: now,
    },
  ];
  const service = new ReportService(
    repository([]) as never,
    repository([]) as never,
    repository(inventory) as never,
    repository([]) as never,
  );

  const result = (await service.inventoryHealth({
    city: 'Bengaluru',
    categoryGroup: 'Outdoor',
  })) as any;

  assert.equal(result.totals.inventory, 2);
  assert.equal(result.totals.fresh, 1);
  assert.equal(result.totals.stale, 1);
  assert.equal(result.totals.freshCoverageRate, 50);
  assert.equal(result.totals.internalCostCoverageRate, 50);
  assert.equal(result.needsAttention[0].inventoryCode, 'OUT-002');
});

test('profitability uses won plans and excludes tax from margin percentage', async () => {
  const plans = [
    {
      _id: 'plan-1',
      campaign: 'campaign-1',
      versionLabel: 'v1',
      title: 'Won plan',
      status: 'Won',
      wonAt: new Date('2026-06-10T10:00:00.000Z'),
      pricing: {
        subtotal: 1000000,
        taxAmount: 180000,
        grandTotal: 1180000,
        internalCostTotal: 700000,
        marginAmount: 300000,
        marginPercentage: 30,
      },
    },
    {
      _id: 'plan-2',
      campaign: 'campaign-2',
      status: 'Shared',
      pricing: { grandTotal: 500000 },
    },
  ];
  const service = new ReportService(
    repository([]) as never,
    repository(plans) as never,
    repository([]) as never,
    repository([]) as never,
  );

  const result = (await service.profitability({})) as any;

  assert.equal(result.totals.wonPlans, 1);
  assert.equal(result.totals.revenue, 1180000);
  assert.equal(result.totals.internalCost, 700000);
  assert.equal(result.totals.margin, 300000);
  assert.equal(result.totals.marginPercentage, 30);
});

test('operations and supplier reports calculate overdue and completion rates', async () => {
  const overdue = new Date();
  overdue.setDate(overdue.getDate() - 2);
  const operations = [
    {
      _id: 'operation-1',
      operationCode: 'OPS-001',
      status: 'In Progress',
      createdAt: new Date(),
      overallProgress: { percentage: 50 },
      items: [
        {
          inventoryCode: 'OUT-001',
          supplierName: 'Supplier A',
          creative: { received: true },
          purchaseOrder: { sent: true },
          mounting: { completed: true },
          proof: { uploaded: true },
          itemStatus: 'Completed',
        },
        {
          inventoryCode: 'OUT-002',
          supplierName: 'Supplier A',
          mounting: { scheduledDate: overdue, completed: false },
          proof: { uploaded: false },
          itemStatus: 'Mounting Scheduled',
        },
      ],
    },
  ];
  const service = new ReportService(
    repository([]) as never,
    repository([]) as never,
    repository([]) as never,
    repository(operations) as never,
  );

  const delivery = (await service.operationsDelivery({})) as any;
  const suppliers = (await service.supplierPerformance({})) as any;

  assert.equal(delivery.totals.overdueMountings, 1);
  assert.equal(delivery.totals.mountingCompletionRate, 50);
  assert.equal(delivery.totals.proofCompletionRate, 50);
  assert.equal(suppliers.suppliers[0].supplierName, 'Supplier A');
  assert.equal(suppliers.suppliers[0].completionRate, 50);
  assert.equal(suppliers.suppliers[0].overdue, 1);
});
