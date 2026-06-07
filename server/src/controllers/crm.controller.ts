import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { CrmEntityFiltersDto } from '../dto/crm.dto.js';
import type { ICrmService } from '../services/crm.service.js';
import type { AuthTokenPayload } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';

const getAuthUser = (locals: { authUser?: AuthTokenPayload }) => {
  if (!locals.authUser) {
    throw new HttpError(401, 'Authentication required');
  }

  return locals.authUser;
};

@injectable()
export class CrmController {
  constructor(
    @inject(TOKENS.CrmService)
    private readonly crmService: ICrmService,
  ) {}

  getSummary = async (_req: Request, res: Response) => {
    const data = await this.crmService.getSummary();
    res.status(200).json({ data });
  };

  getEntities = async (req: Request, res: Response) => {
    const result = await this.crmService.listEntities(req.query as CrmEntityFiltersDto);
    res.status(200).json(result);
  };

  getEntity = async (req: Request, res: Response) => {
    const data = await this.crmService.getEntityById(req.params.id);
    res.status(200).json({ data });
  };

  postEntity = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const data = await this.crmService.createEntity({
      ...req.body,
      createdBy: authUser.userId,
      updatedBy: authUser.userId,
    });
    res.status(201).json({ data });
  };

  patchEntity = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const data = await this.crmService.updateEntity(req.params.id, {
      ...req.body,
      createdBy: undefined,
      updatedBy: authUser.userId,
    });
    res.status(200).json({ data });
  };

  deactivateEntity = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const data = await this.crmService.setEntityStatus(
      req.params.id,
      'inactive',
      authUser.userId,
    );
    res.status(200).json({ data });
  };

  activateEntity = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const data = await this.crmService.setEntityStatus(
      req.params.id,
      'active',
      authUser.userId,
    );
    res.status(200).json({ data });
  };

  getContacts = async (req: Request, res: Response) => {
    const data = await this.crmService.listContacts(req.params.entityId);
    res.status(200).json({ data });
  };

  postContact = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const data = await this.crmService.createContact(req.params.entityId, {
      ...req.body,
      createdBy: authUser.userId,
      updatedBy: authUser.userId,
    });
    res.status(201).json({ data });
  };

  patchContact = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const data = await this.crmService.updateContact(req.params.contactId, {
      ...req.body,
      createdBy: undefined,
      updatedBy: authUser.userId,
    });
    res.status(200).json({ data });
  };

  deactivateContact = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const data = await this.crmService.setContactStatus(
      req.params.contactId,
      'inactive',
      authUser.userId,
    );
    res.status(200).json({ data });
  };

  activateContact = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const data = await this.crmService.setContactStatus(
      req.params.contactId,
      'active',
      authUser.userId,
    );
    res.status(200).json({ data });
  };

  deleteContact = async (req: Request, res: Response) => {
    await this.crmService.deleteContact(req.params.contactId);
    res.status(200).json({ message: 'Contact deleted' });
  };

  searchSuppliers = async (req: Request, res: Response) => {
    const data = await this.crmService.searchSuppliers(req.query.search?.toString());
    res.status(200).json({ data });
  };

  searchCampaignClients = async (req: Request, res: Response) => {
    const data = await this.crmService.searchCampaignClients(req.query.search?.toString());
    res.status(200).json({ data });
  };
}
