import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import type { CrmEntityFiltersDto } from '../dto/crm.dto.js';
import type { IActivityService } from '../services/activity.service.js';
import type { ICrmService } from '../services/crm.service.js';
import type { ICrmCommandService } from '../services/crmCommand.service.js';
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
    @inject(TOKENS.CrmCommandService)
    private readonly commands: ICrmCommandService,
    @inject(TOKENS.ActivityService)
    private readonly activity: IActivityService,
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
    const data = await this.commands.createEntity(req.body, authUser, req);
    res.status(201).json({ data });
  };

  patchEntity = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const data = await this.commands.updateEntity(
      req.params.id,
      req.body,
      authUser,
      req,
    );
    res.status(200).json({ data });
  };

  deactivateEntity = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const data = await this.crmService.setEntityStatus(
      req.params.id,
      'inactive',
      authUser.userId,
    );
    await this.activity.logEntityActivity({
      actor: authUser, action: ACTIVITY_ACTIONS.CRM_DEACTIVATED, entityType: 'CRM',
      entityId: data.id, entityTitle: data.displayName || data.name,
      message: `${data.displayName || data.name} was deactivated.`,
      changes: [{ field: 'status', from: 'active', to: 'inactive' }], req,
    });
    res.status(200).json({ data });
  };

  activateEntity = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const data = await this.crmService.setEntityStatus(
      req.params.id,
      'active',
      authUser.userId,
    );
    await this.activity.logEntityActivity({
      actor: authUser, action: ACTIVITY_ACTIONS.CRM_ACTIVATED, entityType: 'CRM',
      entityId: data.id, entityTitle: data.displayName || data.name,
      message: `${data.displayName || data.name} was activated.`,
      changes: [{ field: 'status', from: 'inactive', to: 'active' }], req,
    });
    res.status(200).json({ data });
  };

  getContacts = async (req: Request, res: Response) => {
    const data = await this.crmService.listContacts(req.params.entityId);
    res.status(200).json({ data });
  };

  postContact = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const data = await this.commands.createContact(
      req.params.entityId,
      req.body,
      authUser,
      req,
    );
    res.status(201).json({ data });
  };

  patchContact = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const data = await this.commands.updateContact(
      req.params.contactId,
      req.body,
      authUser,
      req,
    );
    res.status(200).json({ data });
  };

  deactivateContact = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const data = await this.crmService.setContactStatus(
      req.params.contactId,
      'inactive',
      authUser.userId,
    );
    await this.activity.logEntityActivity({
      actor: authUser, action: ACTIVITY_ACTIONS.CONTACT_UPDATED, entityType: 'Contact',
      entityId: data.id, entityTitle: data.name, parentEntityType: 'CRM',
      parentEntityId: data.crmEntity, message: `${data.name} contact was deactivated.`,
      changes: [{ field: 'status', from: 'active', to: 'inactive' }], req,
    });
    res.status(200).json({ data });
  };

  activateContact = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    const data = await this.crmService.setContactStatus(
      req.params.contactId,
      'active',
      authUser.userId,
    );
    await this.activity.logEntityActivity({
      actor: authUser, action: ACTIVITY_ACTIONS.CONTACT_UPDATED, entityType: 'Contact',
      entityId: data.id, entityTitle: data.name, parentEntityType: 'CRM',
      parentEntityId: data.crmEntity, message: `${data.name} contact was activated.`,
      changes: [{ field: 'status', from: 'inactive', to: 'active' }], req,
    });
    res.status(200).json({ data });
  };

  deleteContact = async (req: Request, res: Response) => {
    const authUser = getAuthUser(res.locals);
    await this.crmService.deleteContact(req.params.contactId);
    await this.activity.logEntityActivity({
      actor: authUser, action: ACTIVITY_ACTIONS.CONTACT_DELETED, entityType: 'Contact',
      entityId: req.params.contactId, message: 'A CRM contact was deleted.', req,
    });
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
