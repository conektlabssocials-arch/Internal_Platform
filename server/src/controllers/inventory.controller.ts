import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { InventoryFiltersDto } from '../dto/inventory.dto.js';
import type { InventoryStatus } from '../models/inventory.model.js';
import type { IInventoryService } from '../services/inventory.service.js';
import type { IActivityService } from '../services/activity.service.js';
import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import type { AuthTokenPayload } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';

const getAuthUser = (locals: { authUser?: AuthTokenPayload }) => {
  if (!locals.authUser) {
    throw new HttpError(401, 'Authentication required');
  }

  return locals.authUser;
};

@injectable()
export class InventoryController {
  constructor(
    @inject(TOKENS.InventoryService)
    private readonly inventoryService: IInventoryService,
    @inject(TOKENS.ActivityService)
    private readonly activity: IActivityService,
  ) {}

  getInventory = async (req: Request, res: Response) => {
    const result = await this.inventoryService.listInventory(req.query as InventoryFiltersDto);
    res.status(200).json(result);
  };

  getInventorySummary = async (_req: Request, res: Response) => {
    const data = await this.inventoryService.getInventorySummary();
    res.status(200).json({ data });
  };

  getInventoryById = async (req: Request, res: Response) => {
    const item = await this.inventoryService.getInventoryById(req.params.id);
    res.status(200).json({ data: item });
  };

  getPreviewCode = async (req: Request, res: Response) => {
    const previewCode = await this.inventoryService.previewInventoryCode(
      req.query.categoryGroup?.toString(),
      req.query.city?.toString(),
      req.query.area?.toString(),
    );

    res.status(200).json({ previewCode });
  };

  postInventory = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const item = await this.inventoryService.createInventory({
      ...req.body,
      createdBy: authUser.userId,
      updatedBy: authUser.userId,
    });
    await this.activity.logEntityActivity({
      actor: authUser, action: ACTIVITY_ACTIONS.INVENTORY_CREATED, entityType: 'Inventory',
      entityId: item.id, entityCode: item.inventoryCode, entityTitle: item.title,
      message: `${item.inventoryCode} inventory was created.`, req,
    });

    res.status(201).json({ data: item });
  };

  importInventory = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const file = req.file;

    if (!file) {
      throw new HttpError(400, 'A CSV file is required');
    }

    const result = await this.inventoryService.importInventory(file.buffer, authUser.userId);
    res.status(200).json({ data: result });
  };

  patchInventory = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const before = await this.inventoryService.getInventoryById(req.params.id);
    const item = await this.inventoryService.updateInventory(req.params.id, {
      ...req.body,
      createdBy: undefined,
      updatedBy: authUser.userId,
    });
    await this.activity.logEntityActivity({
      actor: authUser, action: ACTIVITY_ACTIONS.INVENTORY_UPDATED, entityType: 'Inventory',
      entityId: item.id, entityCode: item.inventoryCode, entityTitle: item.title,
      message: `${item.inventoryCode} inventory was updated.`,
      changes: this.activity.buildChangeSet(before, item, ['categoryGroup','subCategory','title','city','area','width','height','internalCost','sellingPrice','availabilityStatus','status','confirmationStatus']),
      req,
    });

    res.status(200).json({ data: item });
  };

  deactivateInventory = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const item = await this.inventoryService.setInventoryStatus(
      req.params.id,
      'inactive' as InventoryStatus,
      authUser.userId,
    );
    await this.activity.logEntityActivity({
      actor: authUser, action: ACTIVITY_ACTIONS.INVENTORY_DEACTIVATED, entityType: 'Inventory',
      entityId: item.id, entityCode: item.inventoryCode, entityTitle: item.title,
      message: `${item.inventoryCode} inventory was deactivated.`, metadata: { statusTo: 'inactive' }, req,
    });

    res.status(200).json({ data: item });
  };

  activateInventory = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const item = await this.inventoryService.setInventoryStatus(
      req.params.id,
      'active' as InventoryStatus,
      authUser.userId,
    );
    await this.activity.logEntityActivity({
      actor: authUser, action: ACTIVITY_ACTIONS.INVENTORY_ACTIVATED, entityType: 'Inventory',
      entityId: item.id, entityCode: item.inventoryCode, entityTitle: item.title,
      message: `${item.inventoryCode} inventory was activated.`, metadata: { statusTo: 'active' }, req,
    });

    res.status(200).json({ data: item });
  };

  confirmInventory = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const item = await this.inventoryService.confirmInventory(req.params.id, {
      confirmationNote: req.body.confirmationNote,
      availabilityStatus: req.body.availabilityStatus,
      internalCost: req.body.internalCost,
      sellingPrice: req.body.sellingPrice,
      confirmedBy: authUser.userId,
    });
    await this.activity.logEntityActivity({
      actor: authUser, action: ACTIVITY_ACTIONS.INVENTORY_CONFIRMED, entityType: 'Inventory',
      entityId: item.id, entityCode: item.inventoryCode, entityTitle: item.title,
      message: `${item.inventoryCode} inventory was confirmed.`,
      metadata: { availabilityStatus: item.availabilityStatus, confirmationStatus: item.confirmationStatus }, req,
    });

    res.status(200).json({ data: item });
  };
}
