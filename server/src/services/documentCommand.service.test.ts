import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import type { IActivityService } from './activity.service.js';
import type { IDocumentService } from './document.service.js';
import { DocumentCommandService } from './documentCommand.service.js';
import type { IOperationService } from './operation.service.js';
import type { IPlanService } from './plan.service.js';

const admin = {
  userId: '000000000000000000000001',
  email: 'admin@conektads.com',
  name: 'Admin',
  role: 'admin',
} as const;

const member = {
  ...admin,
  email: 'member@conektads.com',
  role: 'member',
} as const;

const updatedAt = new Date('2026-06-10T09:00:00.000Z');

const createService = ({
  documents = {},
  plans = { getById: async () => ({ updatedAt }) },
  operations = { getById: async () => ({ updatedAt }) },
  activity = {},
}: {
  documents?: Partial<IDocumentService>;
  plans?: Partial<IPlanService>;
  operations?: Partial<IOperationService>;
  activity?: Partial<IActivityService>;
}) =>
  new DocumentCommandService(
    documents as IDocumentService,
    plans as IPlanService,
    operations as IOperationService,
    activity as IActivityService,
  );

test('plan document generation rejects a stale plan before creating a PDF', async () => {
  let generated = false;
  const commands = createService({
    documents: {
      generate: async () => {
        generated = true;
        return {} as never;
      },
    },
  });

  await assert.rejects(
    () =>
      commands.generatePlanDocument(
        '000000000000000000000010',
        {
          documentType: 'PlanProposal',
          expectedUpdatedAt: '2026-06-09T09:00:00.000Z',
        },
        admin,
      ),
    /Plan changed since it was read/,
  );
  assert.equal(generated, false);
});

test('member cannot generate an internal cost sheet', async () => {
  let generated = false;
  const commands = createService({
    documents: {
      generate: async () => {
        generated = true;
        return {} as never;
      },
    },
  });

  await assert.rejects(
    () =>
      commands.generatePlanDocument(
        '000000000000000000000010',
        {
          documentType: 'InternalCostSheet',
          expectedUpdatedAt: updatedAt.toISOString(),
        },
        member,
      ),
    /Only Admin/,
  );
  assert.equal(generated, false);
});

test('plan document generation attributes the actor and writes an audit record', async () => {
  let generatedBy: string | undefined;
  let audit: Record<string, unknown> | undefined;
  const document = {
    id: '000000000000000000000020',
    plan: '000000000000000000000010',
    documentType: 'Quotation' as const,
    fileName: 'quotation.pdf',
    metadata: { campaignCode: 'CMP-2026-0010' },
  };
  const commands = createService({
    documents: {
      generate: async (_planId, _type, userId) => {
        generatedBy = userId;
        return document as never;
      },
    },
    activity: {
      logEntityActivity: async (input) => {
        audit = input as unknown as Record<string, unknown>;
      },
    },
  });

  const result = await commands.generatePlanDocument(
    document.plan,
    {
      documentType: 'Quotation',
      expectedUpdatedAt: updatedAt.toISOString(),
    },
    admin,
  );

  assert.equal(result.id, document.id);
  assert.equal(generatedBy, admin.userId);
  assert.equal(audit?.action, 'DOCUMENT_GENERATED');
  assert.deepEqual(audit?.actor, admin);
  assert.equal(audit?.parentEntityType, 'Plan');
});
