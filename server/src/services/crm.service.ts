import { inject, injectable } from 'tsyringe';
import { Types } from 'mongoose';
import type { FilterQuery } from 'mongoose';

import { TOKENS } from '../config/tokens.js';
import { mapContactToDto, mapCrmEntityToDto } from '../dto/crm.dto.js';
import type {
  ContactDto,
  ContactMutationDto,
  CrmEntityDto,
  CrmEntityFiltersDto,
  CrmEntityMutationDto,
} from '../dto/crm.dto.js';
import {
  crmEntityStatuses,
  crmEntityTypes,
} from '../models/crmEntity.model.js';
import type {
  CrmEntityDocument,
  CrmEntityStatus,
  CrmEntityType,
} from '../models/crmEntity.model.js';
import { contactStatuses } from '../models/contact.model.js';
import type { ContactDocument, ContactStatus } from '../models/contact.model.js';
import type { IContactRepository } from '../repositories/contact.repository.js';
import type { ICrmEntityRepository } from '../repositories/crmEntity.repository.js';
import type { IInventoryRepository } from '../repositories/inventory.repository.js';
import { HttpError } from '../utils/httpError.js';

type PaginatedCrmEntities = {
  data: CrmEntityDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export interface ICrmService {
  getSummary(): Promise<
    { entityType: CrmEntityType; total: number; active: number; inactive: number }[]
  >;
  listEntities(filters: CrmEntityFiltersDto): Promise<PaginatedCrmEntities>;
  getEntityById(id: string): Promise<CrmEntityDto>;
  createEntity(input: CrmEntityMutationDto): Promise<CrmEntityDto>;
  updateEntity(id: string, input: CrmEntityMutationDto): Promise<CrmEntityDto>;
  setEntityStatus(
    id: string,
    status: CrmEntityStatus,
    updatedBy: string,
  ): Promise<CrmEntityDto>;
  listContacts(entityId: string): Promise<ContactDto[]>;
  createContact(entityId: string, input: ContactMutationDto): Promise<ContactDto>;
  updateContact(contactId: string, input: ContactMutationDto): Promise<ContactDto>;
  setContactStatus(
    contactId: string,
    status: ContactStatus,
    updatedBy: string,
  ): Promise<ContactDto>;
  deleteContact(contactId: string): Promise<void>;
  searchSuppliers(search?: string): Promise<
    { id: string; name: string; phone?: string; email?: string }[]
  >;
  getSupplierEntity(id: string): Promise<CrmEntityDocument>;
}

const trimString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const normalizeEmail = (value: unknown) => trimString(value)?.toLowerCase();
const normalizeIdentifier = (value: unknown) => trimString(value)?.toUpperCase();

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
};

const toObjectId = (value?: string) => (value ? new Types.ObjectId(value) : undefined);

const validateObjectId = (id: string, fieldName = 'id') => {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(400, `${fieldName} is invalid`);
  }
};

const validateEnum = <T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName: string,
) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (!allowedValues.includes(value as T)) {
    throw new HttpError(400, `${fieldName} is invalid`);
  }

  return value as T;
};

const getPage = (value?: string) => {
  const page = Number(value || 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
};

const getLimit = (value?: string) => {
  const limit = Number(value || 20);
  return Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20;
};

@injectable()
export class CrmService implements ICrmService {
  constructor(
    @inject(TOKENS.CrmEntityRepository)
    private readonly entityRepository: ICrmEntityRepository,
    @inject(TOKENS.ContactRepository)
    private readonly contactRepository: IContactRepository,
    @inject(TOKENS.InventoryRepository)
    private readonly inventoryRepository: IInventoryRepository,
  ) {}

  async getSummary() {
    const summary = await this.entityRepository.getSummary();
    const summaryByType = new Map(summary.map((item) => [item.entityType, item]));

    return crmEntityTypes.map((entityType) => ({
      entityType,
      total: summaryByType.get(entityType)?.total || 0,
      active: summaryByType.get(entityType)?.active || 0,
      inactive: summaryByType.get(entityType)?.inactive || 0,
    }));
  }

  async listEntities(filters: CrmEntityFiltersDto) {
    const page = getPage(filters.page);
    const limit = getLimit(filters.limit);
    const filter = this.buildEntityFilter(filters);
    const { items, total } = await this.entityRepository.findPaginated(filter, page, limit);
    const primaryContacts = await this.contactRepository.findPrimaryByEntities(
      items.map((item) => item._id.toString()),
    );
    const primaryByEntity = new Map(
      primaryContacts.map((contact) => [contact.crmEntity.toString(), contact]),
    );

    return {
      data: items.map((item) => mapCrmEntityToDto(item, primaryByEntity.get(item._id.toString()))),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  async getEntityById(id: string) {
    const entity = await this.getEntityDocument(id);
    const contacts = await this.contactRepository.findByEntity(id);
    const dto = mapCrmEntityToDto(
      entity,
      contacts.find((contact) => contact.isPrimary),
    );
    dto.contacts = contacts.map(mapContactToDto);

    if (entity.entityType === 'SupplierOwner') {
      const linkedInventory = await this.inventoryRepository.findLinkedToCrmEntity(id, 5);
      dto.linkedInventoryCount = linkedInventory.total;
      dto.linkedInventoryPreview = linkedInventory.items.map((item) => ({
        id: item._id.toString(),
        inventoryCode: item.inventoryCode,
        title: item.title,
        categoryGroup: item.categoryGroup || item.category || undefined,
      }));
    }

    return dto;
  }

  async createEntity(input: CrmEntityMutationDto) {
    const data = this.prepareEntityMutation(input, true);
    await this.ensureNoDuplicateEntity(data);
    const entity = await this.entityRepository.create(data);
    return mapCrmEntityToDto(entity);
  }

  async updateEntity(id: string, input: CrmEntityMutationDto) {
    const entity = await this.getEntityDocument(id);
    const data = this.prepareEntityMutation(input, false);
    await this.ensureNoDuplicateEntity(data, id);

    Object.assign(entity, data);
    const savedEntity = await this.entityRepository.save(entity);
    return mapCrmEntityToDto(savedEntity);
  }

  async setEntityStatus(id: string, status: CrmEntityStatus, updatedBy: string) {
    const entity = await this.getEntityDocument(id);
    entity.status = status;
    entity.updatedBy = toObjectId(updatedBy);
    const savedEntity = await this.entityRepository.save(entity);
    return mapCrmEntityToDto(savedEntity);
  }

  async listContacts(entityId: string) {
    await this.getEntityDocument(entityId);
    const contacts = await this.contactRepository.findByEntity(entityId);
    return contacts.map(mapContactToDto);
  }

  async createContact(entityId: string, input: ContactMutationDto) {
    await this.getEntityDocument(entityId);
    const data = this.prepareContactMutation({ ...input, crmEntity: entityId }, true);

    if (data.isPrimary) {
      await this.contactRepository.unsetPrimaryForEntity(entityId);
    }

    const contact = await this.contactRepository.create(data);
    return mapContactToDto(contact);
  }

  async updateContact(contactId: string, input: ContactMutationDto) {
    const contact = await this.getContactDocument(contactId);
    const data = this.prepareContactMutation(input, false);

    if (data.isPrimary) {
      await this.contactRepository.unsetPrimaryForEntity(
        contact.crmEntity.toString(),
        contactId,
      );
    }

    Object.assign(contact, data);
    const savedContact = await this.contactRepository.save(contact);
    return mapContactToDto(savedContact);
  }

  async setContactStatus(contactId: string, status: ContactStatus, updatedBy: string) {
    return this.updateContact(contactId, { status, updatedBy });
  }

  async deleteContact(contactId: string) {
    validateObjectId(contactId, 'contactId');
    const deleted = await this.contactRepository.deleteById(contactId);

    if (!deleted) {
      throw new HttpError(404, 'Contact not found');
    }
  }

  async searchSuppliers(search?: string) {
    const suppliers = await this.entityRepository.findActiveSuppliers(trimString(search));
    return suppliers.map((supplier) => ({
      id: supplier._id.toString(),
      name: supplier.displayName || supplier.name,
      phone: supplier.phone ?? undefined,
      email: supplier.email ?? undefined,
    }));
  }

  async getSupplierEntity(id: string) {
    const entity = await this.getEntityDocument(id);

    if (entity.entityType !== 'SupplierOwner') {
      throw new HttpError(400, 'Selected CRM entity must be a Supplier / Owner');
    }

    return entity;
  }

  private async getEntityDocument(id: string) {
    validateObjectId(id, 'entityId');
    const entity = await this.entityRepository.findById(id);

    if (!entity) {
      throw new HttpError(404, 'CRM entity not found');
    }

    return entity;
  }

  private async getContactDocument(id: string) {
    validateObjectId(id, 'contactId');
    const contact = await this.contactRepository.findById(id);

    if (!contact) {
      throw new HttpError(404, 'Contact not found');
    }

    return contact;
  }

  private buildEntityFilter(filters: CrmEntityFiltersDto) {
    const filter: FilterQuery<unknown> = {};

    if (filters.entityType) {
      filter.entityType = validateEnum(filters.entityType, crmEntityTypes, 'entityType');
    }

    if (filters.status) {
      filter.status = validateEnum(filters.status, crmEntityStatuses, 'status');
    }

    if (filters.city) {
      filter['address.city'] = new RegExp(filters.city, 'i');
    }

    if (filters.tag) {
      filter.tags = new RegExp(filters.tag, 'i');
    }

    const search = trimString(filters.search);

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { name: regex },
        { displayName: regex },
        { email: regex },
        { phone: regex },
        { gstNumber: regex },
        { 'address.city': regex },
        { tags: regex },
      ];
    }

    return filter;
  }

  private prepareEntityMutation(input: CrmEntityMutationDto, isCreate: boolean) {
    const entityType = isCreate
      ? validateEnum(input.entityType, crmEntityTypes, 'entityType')
      : undefined;
    const status = isCreate
      ? validateEnum(input.status, crmEntityStatuses, 'status')
      : undefined;
    const name = trimString(input.name);

    if (isCreate && (!entityType || !name)) {
      throw new HttpError(400, 'entityType and name are required');
    }

    if (input.name !== undefined && !name) {
      throw new HttpError(400, 'name cannot be empty');
    }

    const data: Record<string, unknown> = {
      entityType,
      name,
      displayName: this.optionalStringValue(input.displayName),
      gstNumber: this.optionalIdentifierValue(input.gstNumber),
      panNumber: this.optionalIdentifierValue(input.panNumber),
      email: this.optionalEmailValue(input.email),
      phone: this.optionalStringValue(input.phone),
      whatsapp: this.optionalStringValue(input.whatsapp),
      website: this.optionalStringValue(input.website),
      address: input.address
        ? {
            line1: trimString(input.address.line1),
            line2: trimString(input.address.line2),
            city: trimString(input.address.city),
            state: trimString(input.address.state),
            pincode: trimString(input.address.pincode),
            country: trimString(input.address.country),
          }
        : undefined,
      billingDetails: input.billingDetails
        ? {
            legalName: trimString(input.billingDetails.legalName),
            gstNumber: normalizeIdentifier(input.billingDetails.gstNumber),
            billingEmail: normalizeEmail(input.billingDetails.billingEmail),
            billingPhone: trimString(input.billingDetails.billingPhone),
            billingAddress: trimString(input.billingDetails.billingAddress),
          }
        : undefined,
      ownerUser:
        input.ownerUser === null || input.ownerUser === ''
          ? null
          : toObjectId(input.ownerUser),
      status,
      tags: normalizeStringArray(input.tags),
      notes: this.optionalStringValue(input.notes),
      files: normalizeStringArray(input.files),
      updatedBy: toObjectId(input.updatedBy),
    };

    if (isCreate) {
      data.createdBy = toObjectId(input.createdBy);
      data.status = status || 'active';
    }

    Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);
    return data;
  }

  private optionalStringValue(value: unknown) {
    if (value === undefined) {
      return undefined;
    }

    return trimString(value) || null;
  }

  private optionalEmailValue(value: unknown) {
    if (value === undefined) {
      return undefined;
    }

    return normalizeEmail(value) || null;
  }

  private optionalIdentifierValue(value: unknown) {
    if (value === undefined) {
      return undefined;
    }

    return normalizeIdentifier(value) || null;
  }

  private async ensureNoDuplicateEntity(
    data: Record<string, unknown>,
    excludedEntityId?: string,
  ) {
    const duplicate = await this.entityRepository.findDuplicate(
      {
        email: typeof data.email === 'string' ? data.email : undefined,
        gstNumber: typeof data.gstNumber === 'string' ? data.gstNumber : undefined,
        panNumber: typeof data.panNumber === 'string' ? data.panNumber : undefined,
      },
      excludedEntityId,
    );

    if (!duplicate) {
      return;
    }

    if (data.email && duplicate.email === data.email) {
      throw new HttpError(409, 'A CRM record with this email already exists');
    }

    if (data.gstNumber && duplicate.gstNumber === data.gstNumber) {
      throw new HttpError(409, 'A CRM record with this GST number already exists');
    }

    throw new HttpError(409, 'A CRM record with this PAN number already exists');
  }

  private prepareContactMutation(input: ContactMutationDto, isCreate: boolean) {
    const name = trimString(input.name);
    const status = validateEnum(input.status, contactStatuses, 'status');

    if (isCreate && (!input.crmEntity || !name)) {
      throw new HttpError(400, 'crmEntity and name are required');
    }

    if (input.name !== undefined && !name) {
      throw new HttpError(400, 'name cannot be empty');
    }

    const data: Record<string, unknown> = {
      crmEntity: isCreate && input.crmEntity ? toObjectId(input.crmEntity) : undefined,
      name,
      role: this.optionalStringValue(input.role),
      phone: this.optionalStringValue(input.phone),
      email: this.optionalEmailValue(input.email),
      whatsapp: this.optionalStringValue(input.whatsapp),
      isPrimary: typeof input.isPrimary === 'boolean' ? input.isPrimary : undefined,
      notes: this.optionalStringValue(input.notes),
      status,
      updatedBy: toObjectId(input.updatedBy),
    };

    if (isCreate) {
      data.createdBy = toObjectId(input.createdBy);
      data.status = status || 'active';
      data.isPrimary = input.isPrimary || false;
    }

    Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);
    return data;
  }
}
