export type CrmEntityType = 'Brand' | 'Agency' | 'Individual' | 'SupplierOwner';
export type CrmStatus = 'active' | 'inactive';

export type CrmAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
};

export type BillingDetails = {
  legalName?: string;
  gstNumber?: string;
  billingEmail?: string;
  billingPhone?: string;
  billingAddress?: string;
};

export type Contact = {
  id: string;
  crmEntity: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  isPrimary: boolean;
  notes?: string;
  status: CrmStatus;
};

export type ContactPayload = Partial<Omit<Contact, 'id' | 'crmEntity'>>;

export type CrmEntity = {
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
  address?: CrmAddress;
  billingDetails?: BillingDetails;
  status: CrmStatus;
  tags: string[];
  notes?: string;
  files: string[];
  primaryContact?: Contact;
  contacts?: Contact[];
  linkedInventoryCount?: number;
  linkedInventoryPreview?: {
    id: string;
    inventoryCode: string;
    title: string;
    categoryGroup?: string;
  }[];
};

export type CrmEntityPayload = Partial<Omit<CrmEntity, 'id' | 'contacts' | 'primaryContact'>>;

export type CrmFilters = {
  entityType?: CrmEntityType;
  status?: CrmStatus;
  city?: string;
  search?: string;
  tag?: string;
  page?: number;
  limit?: number;
};

export type CrmListResponse = {
  data: CrmEntity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type CrmSummaryItem = {
  entityType: CrmEntityType;
  total: number;
  active: number;
  inactive: number;
};

export type SupplierSearchItem = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
};
