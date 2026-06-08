import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';

import { OperationService } from './operation.service.js';
import type { IOperationCounterRepository } from '../repositories/operationCounter.repository.js';
import type { IOperationRepository } from '../repositories/operation.repository.js';
import type { IPlanRepository } from '../repositories/plan.repository.js';
import {
  calculateItemStatus,
  calculateOperationProgress,
  calculateOperationStatus,
} from '../utils/operationStatus.js';

const service = ({
  operations = {},
  counters = {},
  plans = {},
}: {
  operations?: Partial<IOperationRepository>;
  counters?: Partial<IOperationCounterRepository>;
  plans?: Partial<IPlanRepository>;
}) =>
  new OperationService(
    operations as IOperationRepository,
    counters as IOperationCounterRepository,
    plans as IPlanRepository,
  );

test('operation progress uses uploaded proof count as percentage', () => {
  const items = [
    {
      creative: { received: true },
      purchaseOrder: { sent: true },
      mounting: { completed: true },
      proof: { uploaded: true },
      itemStatus: 'Completed',
    },
    {
      creative: { received: false },
      purchaseOrder: { sent: false },
      mounting: { completed: false },
      proof: { uploaded: false },
      itemStatus: 'Creative Pending',
    },
  ];
  const progress = calculateOperationProgress(items);
  assert.equal(progress.percentage, 50);
  assert.equal(progress.proofUploadedCount, 1);
  assert.equal(progress.completedItemCount, 1);
});

test('item and operation statuses follow execution milestones', () => {
  assert.equal(
    calculateItemStatus({
      creative: { required: true, received: false },
      purchaseOrder: { required: true, sent: false },
      mounting: {},
      proof: {},
    }),
    'Creative Pending',
  );
  assert.equal(
    calculateItemStatus({
      creative: { required: true, received: true },
      purchaseOrder: { required: true, sent: false },
      mounting: {},
      proof: {},
    }),
    'PO Pending',
  );
  assert.equal(
    calculateOperationStatus([
      { mounting: { completed: true }, proof: { uploaded: false } },
      { mounting: { completed: true }, proof: { uploaded: false } },
    ]),
    'Proof Pending',
  );
});

test('creating an operation snapshots won Plan and populated inventory data', async () => {
  const operationId = new Types.ObjectId();
  const planId = new Types.ObjectId();
  const campaignId = new Types.ObjectId();
  const clientId = new Types.ObjectId();
  const inventoryId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  let createdData: Record<string, any> = {};
  const operationService = service({
    operations: {
      findByPlan: async () => null,
      create: async (data) => {
        createdData = data;
        return { _id: operationId } as never;
      },
      findByIdPopulated: async () =>
        ({
          _id: operationId,
          ...createdData,
          items: (createdData.items || []).map((item: any) => ({
            _id: new Types.ObjectId(),
            ...item,
          })),
          createdAt: new Date(),
          updatedAt: new Date(),
        }) as never,
    },
    counters: {
      incrementSequence: async () => ({ sequence: 7 }) as never,
    },
    plans: {
      findByIdPopulated: async () =>
        ({
          _id: planId,
          status: 'Won',
          versionLabel: 'v2',
          campaign: {
            _id: campaignId,
            campaignCode: 'CMP-2026-0002',
            title: 'Outdoor Launch',
            client: { _id: clientId, name: 'Fresh Basket' },
          },
          items: [
            {
              inventory: {
                _id: inventoryId,
                supplierName: 'Media Supplier',
                ownerName: 'Site Owner',
              },
              inventoryCode: 'OOH-BLR-001',
              title: 'Junction Hoarding',
              categoryGroup: 'Outdoor',
              subCategory: 'Hoarding',
              city: 'Bengaluru',
              area: 'Koramangala',
              startDate: new Date('2026-08-01'),
              endDate: new Date('2026-08-31'),
              unitInternalCost: 350000,
              totalInternalCost: 350000,
              unitSellingPrice: 500000,
              totalSellingPrice: 500000,
            },
          ],
        }) as never,
    },
  });

  const result = (await operationService.createOperationFromWonPlan(
    planId.toString(),
    userId.toString(),
  )) as {
    operationCode: string;
    items: Array<{
      supplierName?: string;
      itemStatus: string;
      totalInternalCost?: number;
      totalSellingPrice?: number;
    }>;
  };

  assert.equal(result.operationCode, `OPS-${new Date().getFullYear()}-0007`);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].supplierName, 'Media Supplier');
  assert.equal(result.items[0].itemStatus, 'Creative Pending');
  assert.equal(result.items[0].totalInternalCost, 350000);
  assert.equal(result.items[0].totalSellingPrice, 500000);
});

test('members cannot cancel an operation', async () => {
  const operationId = new Types.ObjectId();
  const operationService = service({
    operations: {
      findByIdPopulated: async () =>
        ({
          _id: operationId,
          status: 'Pending',
        }) as never,
    },
  });

  await assert.rejects(
    () =>
      operationService.updateStatus(operationId.toString(), 'Cancelled', {
        userId: new Types.ObjectId().toString(),
        role: 'member',
      }),
    /Only Admin can cancel operations/,
  );
});
