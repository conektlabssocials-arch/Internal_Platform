import type {
  CrmEntityDocument,
  CrmEntityStatus,
  CrmEntityType,
} from '../models/crmEntity.model.js';
import type { ContactDocument, ContactStatus } from '../models/contact.model.js';

export type CrmAddressDto = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
};

export type BillingDetailsDto = {
  legalName?: string;
  gstNumber?: string;
  billingEmail?: string;
  billingPhone?: string;
  billingAddress?: string;
};

export type ContactDto = {
  id: string;
  crmEntity: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  isPrimary: boolean;
  notes?: string;
  status: ContactStatus;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CrmEntityDto = {
  id: string;
  entityType: CrmEntityType;
  name: string;
  displayName?: string;
  gstNumber?: string;
  panNumber?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  address?: CrmAddressDto;
  billingDetails?: BillingDetailsDto;
  ownerUser?: string;
  status: CrmEntityStatus;
  tags: string[];
  notes?: string;
  files: string[];
  primaryContact?: ContactDto;
  contacts?: ContactDto[];
  linkedInventoryCount?: number;
  linkedInventoryPreview?: {
    id: string;
    inventoryCode: string;
    title: string;
    categoryGroup?: string;
  }[];
  createdAt?: Date;
  updatedAt?: Date;
};

export type CrmEntityMutationDto = Partial<Omit<CrmEntityDto, 'id' | 'contacts'>> & {
  createdBy?: string;
  updatedBy?: string;
};

export type ContactMutationDto = Partial<Omit<ContactDto, 'id' | 'crmEntity'>> & {
  crmEntity?: string;
  createdBy?: string;
  updatedBy?: string;
};

export type CrmEntityFiltersDto = {
  entityType?: string;
  status?: string;
  city?: string;
  search?: string;
  tag?: string;
  page?: string;
  limit?: string;
};

const idToString = (value: unknown) => (value ? value.toString() : undefined);

export const mapContactToDto = (contact: ContactDocument): ContactDto => ({
  id: contact._id.toString(),
  crmEntity: contact.crmEntity.toString(),
  name: contact.name,
  role: contact.role ?? undefined,
  phone: contact.phone ?? undefined,
  email: contact.email ?? undefined,
  whatsapp: contact.whatsapp ?? undefined,
  isPrimary: contact.isPrimary,
  notes: contact.notes ?? undefined,
  status: contact.status,
  createdAt: contact.createdAt,
  updatedAt: contact.updatedAt,
});

export const mapCrmEntityToDto = (
  entity: CrmEntityDocument,
  primaryContact?: ContactDocument,
): CrmEntityDto => ({
  id: entity._id.toString(),
  entityType: entity.entityType,
  name: entity.name,
  displayName: entity.displayName ?? undefined,
  gstNumber: entity.gstNumber ?? undefined,
  panNumber: entity.panNumber ?? undefined,
  email: entity.email ?? undefined,
  phone: entity.phone ?? undefined,
  whatsapp: entity.whatsapp ?? undefined,
  website: entity.website ?? undefined,
  address: entity.address
    ? {
        line1: entity.address.line1 ?? undefined,
        line2: entity.address.line2 ?? undefined,
        city: entity.address.city ?? undefined,
        state: entity.address.state ?? undefined,
        pincode: entity.address.pincode ?? undefined,
        country: entity.address.country ?? undefined,
      }
    : undefined,
  billingDetails: entity.billingDetails
    ? {
        legalName: entity.billingDetails.legalName ?? undefined,
        gstNumber: entity.billingDetails.gstNumber ?? undefined,
        billingEmail: entity.billingDetails.billingEmail ?? undefined,
        billingPhone: entity.billingDetails.billingPhone ?? undefined,
        billingAddress: entity.billingDetails.billingAddress ?? undefined,
      }
    : undefined,
  ownerUser: idToString(entity.ownerUser),
  status: entity.status,
  tags: entity.tags || [],
  notes: entity.notes ?? undefined,
  files: entity.files || [],
  primaryContact: primaryContact ? mapContactToDto(primaryContact) : undefined,
  createdAt: entity.createdAt,
  updatedAt: entity.updatedAt,
});
