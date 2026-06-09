import { inject, injectable } from 'tsyringe';
import type { Request } from 'express';

import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import { TOKENS } from '../config/tokens.js';
import type {
  ConfirmInventoryDto,
  InventoryDto,
} from '../dto/inventory.dto.js';
import type { InventoryStatus } from '../models/inventory.model.js';
import type { IActivityService } from './activity.service.js';
import type { CampaignCommandActor } from './campaignCommand.service.js';
import type { IInventoryService } from './inventory.service.js';
import { HttpError } from '../utils/httpError.js';

export type ConfirmInventoryCommandInput = Omit<
  ConfirmInventoryDto,
  'confirmedBy'
> & {
  expectedUpdatedAt?: string;
};

export interface IInventoryCommandService {
  confirm(
    id: string,
    input: ConfirmInventoryCommandInput,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<InventoryDto>;
  changeStatus(
    id: string,
    expectedCurrentStatus: InventoryStatus,
    expectedUpdatedAt: string | undefined,
    status: InventoryStatus,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<InventoryDto>;
}

const timestamp = (value?: Date | string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
};

@injectable()
export class InventoryCommandService implements IInventoryCommandService {
  constructor(
    @inject(TOKENS.InventoryService)
    private readonly inventory: IInventoryService,
    @inject(TOKENS.ActivityService)
    private readonly activity: IActivityService,
  ) {}

  async confirm(
    id: string,
    input: ConfirmInventoryCommandInput,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    const before = await this.inventory.getInventoryById(id);
    this.assertFresh(before.updatedAt, input.expectedUpdatedAt);
    const { expectedUpdatedAt: _expectedUpdatedAt, ...mutation } = input;
    const item = await this.inventory.confirmInventory(id, {
      ...mutation,
      confirmedBy: actor.userId,
    });
    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.INVENTORY_CONFIRMED,
      entityType: 'Inventory',
      entityId: item.id,
      entityCode: item.inventoryCode,
      entityTitle: item.title,
      message: `${item.inventoryCode} inventory was confirmed.`,
      metadata: {
        availabilityStatus: item.availabilityStatus,
        confirmationStatus: item.confirmationStatus,
      },
      changes: this.activity.buildChangeSet(before, item, [
        'availabilityStatus',
        'internalCost',
        'sellingPrice',
        'confirmationStatus',
      ]),
      req,
    });
    return item;
  }

  async changeStatus(
    id: string,
    expectedCurrentStatus: InventoryStatus,
    expectedUpdatedAt: string | undefined,
    status: InventoryStatus,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    if (actor.role !== 'admin') {
      throw new HttpError(403, 'Admin access required');
    }
    const before = await this.inventory.getInventoryById(id);
    if (before.status !== expectedCurrentStatus) {
      throw new HttpError(
        409,
        `Inventory status is ${before.status}, not ${expectedCurrentStatus}. Read it again before updating.`,
      );
    }
    this.assertFresh(before.updatedAt, expectedUpdatedAt);
    if (before.status === status) {
      throw new HttpError(409, `Inventory is already ${status}`);
    }
    const item = await this.inventory.setInventoryStatus(
      id,
      status,
      actor.userId,
    );
    await this.activity.logEntityActivity({
      actor,
      action:
        status === 'active'
          ? ACTIVITY_ACTIONS.INVENTORY_ACTIVATED
          : ACTIVITY_ACTIONS.INVENTORY_DEACTIVATED,
      entityType: 'Inventory',
      entityId: item.id,
      entityCode: item.inventoryCode,
      entityTitle: item.title,
      message: `${item.inventoryCode} inventory was ${status === 'active' ? 'activated' : 'deactivated'}.`,
      changes: [{ field: 'status', from: before.status, to: status }],
      metadata: { statusTo: status },
      req,
    });
    return item;
  }

  private assertFresh(
    actual: Date | string | undefined,
    expected: string | undefined,
  ) {
    if (expected && timestamp(actual) !== timestamp(expected)) {
      throw new HttpError(
        409,
        'Inventory changed since it was read. Read it again before updating.',
      );
    }
  }
}
