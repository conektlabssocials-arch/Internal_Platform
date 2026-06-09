import { inject, injectable } from 'tsyringe';
import type { Request } from 'express';

import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import { TOKENS } from '../config/tokens.js';
import type {
  ContactDto,
  ContactMutationDto,
  CrmEntityDto,
  CrmEntityMutationDto,
} from '../dto/crm.dto.js';
import type { IActivityService } from './activity.service.js';
import type { CampaignCommandActor } from './campaignCommand.service.js';
import type { ICrmService } from './crm.service.js';
import { HttpError } from '../utils/httpError.js';

export type CrmUpdateCommandInput = CrmEntityMutationDto & {
  expectedUpdatedAt?: string;
};

export type ContactUpdateCommandInput = ContactMutationDto & {
  entityId?: string;
  expectedUpdatedAt?: string;
};

export interface ICrmCommandService {
  createEntity(
    input: CrmEntityMutationDto,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<CrmEntityDto>;
  updateEntity(
    id: string,
    input: CrmUpdateCommandInput,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<CrmEntityDto>;
  createContact(
    entityId: string,
    input: ContactMutationDto,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<ContactDto>;
  updateContact(
    contactId: string,
    input: ContactUpdateCommandInput,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<ContactDto>;
}

const timestamp = (value?: Date | string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
};

@injectable()
export class CrmCommandService implements ICrmCommandService {
  constructor(
    @inject(TOKENS.CrmService)
    private readonly crm: ICrmService,
    @inject(TOKENS.ActivityService)
    private readonly activity: IActivityService,
  ) {}

  async createEntity(
    input: CrmEntityMutationDto,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    const data = await this.crm.createEntity({
      ...input,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });
    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.CRM_CREATED,
      entityType: 'CRM',
      entityId: data.id,
      entityTitle: data.displayName || data.name,
      message: `${data.displayName || data.name} was created in CRM.`,
      req,
    });
    return data;
  }

  async updateEntity(
    id: string,
    input: CrmUpdateCommandInput,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    const before = await this.crm.getEntityById(id);
    this.assertFresh(before.updatedAt, input.expectedUpdatedAt, 'CRM record');
    const { expectedUpdatedAt: _expectedUpdatedAt, ...mutation } = input;
    const data = await this.crm.updateEntity(id, {
      ...mutation,
      createdBy: undefined,
      updatedBy: actor.userId,
    });
    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.CRM_UPDATED,
      entityType: 'CRM',
      entityId: data.id,
      entityTitle: data.displayName || data.name,
      message: `${data.displayName || data.name} was updated.`,
      changes: this.activity.buildChangeSet(before, data, [
        'name',
        'displayName',
        'email',
        'phone',
        'tags',
        'notes',
      ]),
      req,
    });
    return data;
  }

  async createContact(
    entityId: string,
    input: ContactMutationDto,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    await this.crm.getEntityById(entityId);
    const data = await this.crm.createContact(entityId, {
      ...input,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });
    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.CONTACT_CREATED,
      entityType: 'Contact',
      entityId: data.id,
      entityTitle: data.name,
      parentEntityType: 'CRM',
      parentEntityId: data.crmEntity,
      message: `${data.name} was added as a CRM contact.`,
      req,
    });
    return data;
  }

  async updateContact(
    contactId: string,
    input: ContactUpdateCommandInput,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    const before = await this.crm.getContactById(contactId);
    if (input.entityId && before.crmEntity !== input.entityId) {
      throw new HttpError(404, 'Contact not found for this CRM record');
    }
    this.assertFresh(before.updatedAt, input.expectedUpdatedAt, 'Contact');
    const {
      entityId: _entityId,
      expectedUpdatedAt: _expectedUpdatedAt,
      ...mutation
    } = input;
    const data = await this.crm.updateContact(contactId, {
      ...mutation,
      createdBy: undefined,
      updatedBy: actor.userId,
    });
    await this.activity.logEntityActivity({
      actor,
      action: data.isPrimary
        ? ACTIVITY_ACTIONS.CONTACT_MARKED_PRIMARY
        : ACTIVITY_ACTIONS.CONTACT_UPDATED,
      entityType: 'Contact',
      entityId: data.id,
      entityTitle: data.name,
      parentEntityType: 'CRM',
      parentEntityId: data.crmEntity,
      message: data.isPrimary
        ? `${data.name} was marked as primary contact.`
        : `${data.name} contact was updated.`,
      changes: this.activity.buildChangeSet(before, data, [
        'name',
        'role',
        'phone',
        'email',
        'whatsapp',
        'isPrimary',
        'notes',
        'status',
      ]),
      req,
    });
    return data;
  }

  private assertFresh(
    actual: Date | string | undefined,
    expected: string | undefined,
    entity: string,
  ) {
    if (expected && timestamp(actual) !== timestamp(expected)) {
      throw new HttpError(
        409,
        `${entity} changed since it was read. Read it again before updating.`,
      );
    }
  }
}
