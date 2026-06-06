import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';

import { CrmService } from './crm.service.js';
import type { IContactRepository } from '../repositories/contact.repository.js';
import type { ICrmEntityRepository } from '../repositories/crmEntity.repository.js';
import type { IInventoryRepository } from '../repositories/inventory.repository.js';

const createService = ({
  entityRepository = {},
  contactRepository = {},
  inventoryRepository = {},
}: {
  entityRepository?: Partial<ICrmEntityRepository>;
  contactRepository?: Partial<IContactRepository>;
  inventoryRepository?: Partial<IInventoryRepository>;
}) =>
  new CrmService(
    entityRepository as ICrmEntityRepository,
    contactRepository as IContactRepository,
    inventoryRepository as IInventoryRepository,
  );

test('CRM summary includes every entity type with zero-filled counts', async () => {
  const service = createService({
    entityRepository: {
      getSummary: async () => [
        { entityType: 'Brand', total: 3, active: 2, inactive: 1 },
      ],
    },
  });

  const summary = await service.getSummary();

  assert.deepEqual(summary, [
    { entityType: 'Brand', total: 3, active: 2, inactive: 1 },
    { entityType: 'Agency', total: 0, active: 0, inactive: 0 },
    { entityType: 'Individual', total: 0, active: 0, inactive: 0 },
    { entityType: 'SupplierOwner', total: 0, active: 0, inactive: 0 },
  ]);
});

test('creating a primary contact unsets the previous primary contact', async () => {
  const entityId = new Types.ObjectId();
  let unsetEntityId = '';

  const service = createService({
    entityRepository: {
      findById: async () =>
        ({
          _id: entityId,
          entityType: 'Brand',
          name: 'Example Brand',
          status: 'active',
          tags: [],
          files: [],
        }) as never,
    },
    contactRepository: {
      unsetPrimaryForEntity: async (id) => {
        unsetEntityId = id;
      },
      create: async (data) =>
        ({
          _id: new Types.ObjectId(),
          ...data,
          crmEntity: entityId,
          name: 'New Primary',
          isPrimary: true,
          status: 'active',
        }) as never,
    },
  });

  const contact = await service.createContact(entityId.toString(), {
    name: 'New Primary',
    isPrimary: true,
  });

  assert.equal(unsetEntityId, entityId.toString());
  assert.equal(contact.isPrimary, true);
});

test('inventory supplier links reject CRM entities that are not SupplierOwner', async () => {
  const entityId = new Types.ObjectId();
  const service = createService({
    entityRepository: {
      findById: async () =>
        ({
          _id: entityId,
          entityType: 'Agency',
          name: 'Media Agency',
          status: 'active',
          tags: [],
          files: [],
        }) as never,
    },
  });

  await assert.rejects(
    () => service.getSupplierEntity(entityId.toString()),
    /must be a Supplier \/ Owner/,
  );
});

test('duplicate CRM email is rejected before creating a record', async () => {
  let createCalled = false;
  const service = createService({
    entityRepository: {
      findDuplicate: async () =>
        ({
          _id: new Types.ObjectId(),
          entityType: 'Brand',
          name: 'Existing Brand',
          email: 'hello@example.com',
          status: 'active',
          tags: [],
          files: [],
        }) as never,
      create: async () => {
        createCalled = true;
        return {} as never;
      },
    },
  });

  await assert.rejects(
    () =>
      service.createEntity({
        entityType: 'Brand',
        name: 'New Brand',
        email: 'HELLO@example.com',
      }),
    /email already exists/,
  );
  assert.equal(createCalled, false);
});
