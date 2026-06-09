import { inject, injectable } from 'tsyringe';
import type { Request } from 'express';

import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import { TOKENS } from '../config/tokens.js';
import type { mapOperationToDto } from '../dto/operation.dto.js';
import type { OperationStatus } from '../models/operation.model.js';
import type { IActivityService } from './activity.service.js';
import type { CampaignCommandActor } from './campaignCommand.service.js';
import type { IOperationService } from './operation.service.js';
import { HttpError } from '../utils/httpError.js';

type OperationDto = ReturnType<typeof mapOperationToDto>;
type Mutation = Record<string, unknown>;
type ItemMutationKind =
  | 'item'
  | 'creative'
  | 'purchaseOrder'
  | 'mounting'
  | 'proof'
  | 'takedown';

export type OperationStatusCommandInput = {
  status: OperationStatus;
  expectedCurrentStatus?: OperationStatus;
  expectedUpdatedAt?: string;
};

export type OperationItemCommandInput = {
  expectedUpdatedAt?: string;
  mutation: Mutation;
};

export interface IOperationCommandService {
  updateOperation(
    id: string,
    input: Mutation,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<OperationDto>;
  changeStatus(
    id: string,
    input: OperationStatusCommandInput,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<OperationDto>;
  updateItem(
    operationId: string,
    itemId: string,
    kind: ItemMutationKind,
    input: OperationItemCommandInput,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<OperationDto>;
}

const timestamp = (value?: Date | string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
};

const itemAction: Record<
  ItemMutationKind,
  { action: string; verb: string }
> = {
  item: {
    action: ACTIVITY_ACTIONS.OPERATION_ITEM_UPDATED,
    verb: 'updated',
  },
  creative: {
    action: ACTIVITY_ACTIONS.CREATIVE_UPDATED,
    verb: 'creative was updated for',
  },
  purchaseOrder: {
    action: ACTIVITY_ACTIONS.PO_UPDATED,
    verb: 'purchase order was updated for',
  },
  mounting: {
    action: ACTIVITY_ACTIONS.MOUNTING_UPDATED,
    verb: 'mounting was updated for',
  },
  proof: {
    action: ACTIVITY_ACTIONS.PROOF_UPDATED,
    verb: 'proof was updated for',
  },
  takedown: {
    action: ACTIVITY_ACTIONS.TAKEDOWN_UPDATED,
    verb: 'takedown was updated for',
  },
};

@injectable()
export class OperationCommandService implements IOperationCommandService {
  constructor(
    @inject(TOKENS.OperationService)
    private readonly operations: IOperationService,
    @inject(TOKENS.ActivityService)
    private readonly activity: IActivityService,
  ) {}

  async updateOperation(
    id: string,
    input: Mutation,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    const before = (await this.operations.getById(id)) as OperationDto;
    const data = (await this.operations.update(id, input, {
      userId: actor.userId,
      role: actor.role as 'admin' | 'member',
    })) as OperationDto;

    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.OPERATION_UPDATED,
      entityType: 'Operation',
      entityId: data.id,
      entityCode: data.operationCode,
      entityTitle: data.campaignTitle ?? undefined,
      message: `${data.operationCode} was updated.`,
      changes: this.activity.buildChangeSet(before, data, [
        'operationOwner.id',
        'priority',
        'status',
        'importantDates',
        'notes',
      ]),
      req,
    });

    return data;
  }

  async changeStatus(
    id: string,
    input: OperationStatusCommandInput,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    const before = (await this.operations.getById(id)) as OperationDto;
    this.assertFresh(before, input.expectedUpdatedAt);
    if (
      input.expectedCurrentStatus &&
      before.status !== input.expectedCurrentStatus
    ) {
      throw new HttpError(
        409,
        `Operation status is ${before.status}, not ${input.expectedCurrentStatus}. Read the operation again before updating.`,
      );
    }
    if (before.status === input.status) {
      throw new HttpError(409, `Operation is already ${input.status}`);
    }

    const data = (await this.operations.updateStatus(id, input.status, {
      userId: actor.userId,
      role: actor.role as 'admin' | 'member',
    })) as OperationDto;

    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.OPERATION_STATUS_CHANGED,
      entityType: 'Operation',
      entityId: data.id,
      entityCode: data.operationCode,
      entityTitle: data.campaignTitle ?? undefined,
      message: `${data.operationCode} status changed from ${before.status} to ${data.status}.`,
      changes: [{ field: 'status', from: before.status, to: data.status }],
      metadata: { statusFrom: before.status, statusTo: data.status },
      req,
    });

    return data;
  }

  async updateItem(
    operationId: string,
    itemId: string,
    kind: ItemMutationKind,
    input: OperationItemCommandInput,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    const before = (await this.operations.getById(operationId)) as OperationDto;
    this.assertFresh(before, input.expectedUpdatedAt);
    const existingItem = before.items.find((item) => item.id === itemId);
    if (!existingItem) throw new HttpError(404, 'Operation item not found');

    const data = (await this.callItemMutation(
      operationId,
      itemId,
      kind,
      input.mutation,
      actor.userId,
    )) as OperationDto;
    const item = data.items.find((candidate) => candidate.id === itemId);
    const config = itemAction[kind];

    await this.activity.logEntityActivity({
      actor,
      action: config.action,
      entityType: 'OperationItem',
      entityId: item?.id,
      entityCode: item?.inventoryCode,
      entityTitle: item?.title,
      parentEntityType: 'Operation',
      parentEntityId: data.id,
      parentEntityCode: data.operationCode,
      message:
        config.verb === 'updated'
          ? `${item?.inventoryCode || 'Operation item'} was updated.`
          : `${data.operationCode} ${config.verb} ${item?.inventoryCode || 'an item'}.`,
      req,
    });

    return data;
  }

  private assertFresh(operation: OperationDto, expectedUpdatedAt?: string) {
    if (
      expectedUpdatedAt &&
      timestamp(operation.updatedAt) !== timestamp(expectedUpdatedAt)
    ) {
      throw new HttpError(
        409,
        'Operation changed since it was read. Read the operation again before updating.',
      );
    }
  }

  private callItemMutation(
    operationId: string,
    itemId: string,
    kind: ItemMutationKind,
    mutation: Mutation,
    actorId: string,
  ) {
    switch (kind) {
      case 'item':
        return this.operations.updateItem(
          operationId,
          itemId,
          mutation,
          actorId,
        );
      case 'creative':
        return this.operations.updateCreative(
          operationId,
          itemId,
          mutation,
          actorId,
        );
      case 'purchaseOrder':
        return this.operations.updatePurchaseOrder(
          operationId,
          itemId,
          mutation,
          actorId,
        );
      case 'mounting':
        return this.operations.updateMounting(
          operationId,
          itemId,
          mutation,
          actorId,
        );
      case 'proof':
        return this.operations.updateProof(
          operationId,
          itemId,
          mutation,
          actorId,
        );
      case 'takedown':
        return this.operations.updateTakedown(
          operationId,
          itemId,
          mutation,
          actorId,
        );
    }
  }
}
