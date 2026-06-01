import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { InventoryFiltersDto } from '../dto/inventory.dto.js';
import type { InventoryStatus } from '../models/inventory.model.js';
import type { IInventoryService } from '../services/inventory.service.js';
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
  ) {}

  getInventory = async (req: Request, res: Response) => {
    const result = await this.inventoryService.listInventory(req.query as InventoryFiltersDto);
    res.status(200).json(result);
  };

  getInventoryById = async (req: Request, res: Response) => {
    const item = await this.inventoryService.getInventoryById(req.params.id);
    res.status(200).json({ data: item });
  };

  getPreviewCode = async (req: Request, res: Response) => {
    const previewCode = await this.inventoryService.previewInventoryCode(
      req.query.category?.toString(),
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

    res.status(201).json({ data: item });
  };

  patchInventory = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const item = await this.inventoryService.updateInventory(req.params.id, {
      ...req.body,
      createdBy: undefined,
      updatedBy: authUser.userId,
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

    res.status(200).json({ data: item });
  };

  activateInventory = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const item = await this.inventoryService.setInventoryStatus(
      req.params.id,
      'active' as InventoryStatus,
      authUser.userId,
    );

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

    res.status(200).json({ data: item });
  };
}
