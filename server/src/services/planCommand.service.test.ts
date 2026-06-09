import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import type { IActivityService } from './activity.service.js';
import type { IOperationService } from './operation.service.js';
import { PlanCommandService } from './planCommand.service.js';
import type { IPlanService } from './plan.service.js';

const actor = {
  userId: '000000000000000000000001',
  email: 'admin@conektads.com',
  name: 'Admin',
  role: 'admin',
};

const plan = (status: 'Draft' | 'Shared' | 'Negotiating' | 'Won' | 'Lost') => ({
  id: '000000000000000000000010',
  campaign: {
    id: '000000000000000000000020',
    name: 'Campaign',
    campaignCode: 'CMP-2026-0010',
  },
  versionNumber: 1,
  versionLabel: 'v1',
  title: 'Campaign Plan v1',
  status,
  isLocked: status !== 'Draft',
  items: [],
  pricing: {
    subtotal: 0,
    taxPercentage: 0,
    taxAmount: 0,
    grandTotal: 0,
    internalCostTotal: 0,
    marginAmount: 0,
    marginPercentage: 0,
  },
});

test('plan command rejects a stale expected status', async () => {
  let updated = false;
  const plans = {
    getById: async () => plan('Negotiating'),
    updateStatus: async () => {
      updated = true;
      return plan('Won');
    },
  } as unknown as IPlanService;
  const commands = new PlanCommandService(
    plans,
    {} as IOperationService,
    {} as IActivityService,
  );

  await assert.rejects(
    () =>
      commands.changeStatus(
        plan('Shared').id,
        { expectedCurrentStatus: 'Shared', status: 'Won' },
        actor,
      ),
    /status is Negotiating, not Shared/,
  );
  assert.equal(updated, false);
});

test('winning a plan audits the plan and newly created operation', async () => {
  const audit: Record<string, unknown>[] = [];
  let mutation: Record<string, unknown> | undefined;
  let operationReads = 0;
  const plans = {
    getById: async () => plan('Negotiating'),
    updateStatus: async (_id: string, input: Record<string, unknown>) => {
      mutation = input;
      return plan('Won');
    },
  } as unknown as IPlanService;
  const operations = {
    getByPlan: async () => {
      operationReads += 1;
      if (operationReads === 1) throw new Error('Operation not found');
      return {
        id: '000000000000000000000030',
        operationCode: 'OPS-2026-0001',
        campaignTitle: 'Campaign',
      };
    },
  } as unknown as IOperationService;
  const activity = {
    logEntityActivity: async (input: Record<string, unknown>) => {
      audit.push(input);
    },
  } as unknown as IActivityService;
  const commands = new PlanCommandService(plans, operations, activity);

  await commands.changeStatus(
    plan('Negotiating').id,
    { expectedCurrentStatus: 'Negotiating', status: 'Won' },
    actor,
  );

  assert.deepEqual(mutation, { status: 'Won', actorId: actor.userId });
  assert.equal(audit[0]?.action, 'PLAN_WON');
  assert.equal(audit[1]?.action, 'OPERATION_CREATED');
});
