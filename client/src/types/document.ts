export type PlanDocumentType =
  | 'PlanProposal'
  | 'PlanProposalV2'
  | 'Quotation'
  | 'InternalCostSheet';
export type OperationDocumentType = 'WorkOrder' | 'PurchaseOrder' | 'ExecutionReport';
export type DocumentType = PlanDocumentType | OperationDocumentType;

export type DocumentStatus = 'processing' | 'ready' | 'failed';

export type DocumentRecord = {
  id: string;
  plan: string;
  campaign: string;
  operation?: string;
  documentType: DocumentType;
  versionNumber: number;
  fileName: string;
  fileUrl?: string;
  status?: DocumentStatus;
  progress?: number;
  error?: string;
  generatedBy?: {
    id: string;
    name: string;
    email?: string;
  };
  generatedAt: string;
  metadata: {
    planVersionLabel?: string;
    campaignCode?: string;
    campaignTitle?: string;
    clientName?: string;
    operationCode?: string;
    supplierName?: string;
    poNumber?: string;
    partial?: boolean;
    grandTotal?: number;
  };
  createdAt?: string;
};

export type PlanDocument = Omit<DocumentRecord, 'documentType'> & {
  documentType: PlanDocumentType;
};

export type OperationDocument = Omit<DocumentRecord, 'documentType'> & {
  documentType: OperationDocumentType;
};
