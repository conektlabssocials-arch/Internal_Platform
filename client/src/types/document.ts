export type DocumentType = 'PlanProposal' | 'Quotation' | 'InternalCostSheet';

export type PlanDocument = {
  id: string;
  plan: string;
  campaign: string;
  documentType: DocumentType;
  versionNumber: number;
  fileName: string;
  fileUrl?: string;
  generatedBy?: {
    id: string;
    name: string;
    email?: string;
  };
  generatedAt: string;
  metadata: {
    planVersionLabel?: string;
    campaignCode?: string;
    clientName?: string;
    grandTotal?: number;
  };
  createdAt?: string;
};
