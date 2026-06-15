import fs from 'node:fs/promises';
import path from 'node:path';
import { inject, injectable } from 'tsyringe';
import { Types } from 'mongoose';

import { TOKENS } from '../config/tokens.js';
import type { DocumentDocument, DocumentType } from '../models/document.model.js';
import type { IDocumentRepository } from '../repositories/document.repository.js';
import type { IOperationCounterRepository } from '../repositories/operationCounter.repository.js';
import type { IOperationRepository } from '../repositories/operation.repository.js';
import type { IPlanRepository } from '../repositories/plan.repository.js';
import { buildExecutionReportHtml } from '../templates/executionReport.template.js';
import { buildInternalCostSheetHtml } from '../templates/internalCostSheet.template.js';
import { buildPlanProposalHtml } from '../templates/planProposal.template.js';
import { buildPlanProposalV2Html } from '../templates/planProposalV2.template.js';
import { buildPurchaseOrderHtml } from '../templates/purchaseOrder.template.js';
import { buildQuotationHtml } from '../templates/quotation.template.js';
import type {
  TemplateOperationData,
  TemplatePlanData,
} from '../templates/template.utils.js';
import { buildWorkOrderHtml } from '../templates/workOrder.template.js';
import {
  buildDocumentFileName,
  documentStoragePath,
  PdfService,
} from './pdf.service.js';
import {
  formatPurchaseOrderNumber,
  getPurchaseOrderCounterKey,
} from '../utils/operationCode.js';
import { HttpError } from '../utils/httpError.js';

export interface IDocumentService {
  generate(planId: string, documentType: string, actorId: string): Promise<unknown>;
  listByPlan(planId: string): Promise<unknown[]>;
  generateOperation(
    operationId: string,
    documentType: string,
    actorId: string,
  ): Promise<unknown>;
  listByOperation(operationId: string): Promise<unknown[]>;
  getDownload(id: string): Promise<{ fileName: string; filePath?: string; remoteUrl?: string }>;
}

const planDocumentTypes: DocumentType[] = [
  'PlanProposal',
  'PlanProposalV2',
  'Quotation',
  'InternalCostSheet',
];
const operationDocumentTypes: DocumentType[] = [
  'WorkOrder',
  'PurchaseOrder',
  'ExecutionReport',
];

const ref = (value: any) =>
  value && typeof value === 'object' && value._id
    ? { id: value._id.toString(), name: value.name || '', email: value.email }
    : undefined;

const mapDocument = (document: DocumentDocument) => ({
  id: document._id.toString(),
  plan: document.plan.toString(),
  campaign: document.campaign.toString(),
  operation: document.operation?.toString(),
  documentType: document.documentType,
  versionNumber: document.versionNumber,
  fileName: document.fileName,
  fileUrl: document.fileUrl,
  generatedBy: ref(document.generatedBy),
  generatedAt: document.generatedAt,
  metadata: document.metadata,
  createdAt: document.createdAt,
});

const getClientName = (campaign: any) =>
  campaign.client?.displayName || campaign.client?.name || 'Client';

const toTemplateData = (plan: any, generatedAt: Date): TemplatePlanData => {
  const campaign = plan.campaign;
  return {
    generatedAt,
    campaignCode: campaign.campaignCode || '',
    campaignTitle: campaign.title || plan.title,
    campaignBrief: campaign.brief,
    clientName: getClientName(campaign),
    planVersionLabel: plan.versionLabel,
    clientNotes: plan.clientNotes,
    internalNotes: plan.internalNotes,
    items: (plan.items || []).map((item: any) => {
      const inventory = item.inventory && typeof item.inventory === 'object'
        ? item.inventory
        : undefined;
      return {
      inventoryCode: item.inventoryCode,
      title: item.title,
      categoryGroup: item.categoryGroup,
      subCategory: item.subCategory,
      city: item.city,
      area: item.area,
      width: item.width,
      height: item.height,
      totalSqFt: item.totalSqFt,
      location: item.location || inventory?.location
        ? {
            address: item.location?.address ?? inventory?.location?.address,
            latitude: item.location?.latitude ?? inventory?.location?.latitude,
            longitude: item.location?.longitude ?? inventory?.location?.longitude,
          }
        : undefined,
      photos: item.photos || [],
      route: item.route,
      depot: item.depot,
      itinerary: item.itinerary,
      screenSize: item.screenSize ?? inventory?.screenSize,
      numberOfScreens: item.numberOfScreens ?? inventory?.numberOfScreens,
      households: item.households ?? inventory?.households,
      approxReach: item.approxReach ?? inventory?.approxReach,
      monthlyImpressions: item.monthlyImpressions ?? inventory?.monthlyImpressions,
      buildingAge: item.buildingAge ?? inventory?.buildingAge,
      startDate: item.startDate,
      endDate: item.endDate,
      quantity: item.quantity || 1,
      unitSellingPrice: item.unitSellingPrice || 0,
      totalSellingPrice: item.totalSellingPrice || 0,
      unitInternalCost: item.unitInternalCost || 0,
      totalInternalCost: item.totalInternalCost || 0,
      marginAmount: item.marginAmount || 0,
      marginPercentage: item.marginPercentage || 0,
      notes: item.notes,
      };
    }),
    pricing: {
      subtotal: plan.pricing?.subtotal || 0,
      taxPercentage: plan.pricing?.taxPercentage || 0,
      taxAmount: plan.pricing?.taxAmount || 0,
      grandTotal: plan.pricing?.grandTotal || 0,
      internalCostTotal: plan.pricing?.internalCostTotal || 0,
      marginAmount: plan.pricing?.marginAmount || 0,
      marginPercentage: plan.pricing?.marginPercentage || 0,
    },
  };
};

const buildHtml = (type: DocumentType, data: TemplatePlanData) => {
  if (type === 'PlanProposal') return buildPlanProposalHtml(data);
  if (type === 'PlanProposalV2') return buildPlanProposalV2Html(data);
  if (type === 'Quotation') return buildQuotationHtml(data);
  return buildInternalCostSheetHtml(data);
};

const toOperationTemplateData = (
  operation: any,
  generatedAt: Date,
  poNumber?: string,
): TemplateOperationData => {
  const items = (operation.items || []).map((item: any) => ({
    inventoryCode: item.inventoryCode,
    title: item.title,
    categoryGroup: item.categoryGroup,
    subCategory: item.subCategory,
    city: item.city,
    area: item.area,
    width: item.width,
    height: item.height,
    totalSqFt: item.totalSqFt,
    location: item.location?.toObject?.() || item.location,
    route: item.route,
    depot: item.depot,
    itinerary: item.itinerary,
    campaignStartDate: item.campaignStartDate,
    campaignEndDate: item.campaignEndDate,
    unitSellingPrice: item.unitSellingPrice || 0,
    totalSellingPrice: item.totalSellingPrice || 0,
    unitInternalCost: item.unitInternalCost || 0,
    totalInternalCost: item.totalInternalCost || 0,
    supplierName: item.supplierName,
    ownerName: item.ownerName,
    creative: item.creative?.toObject?.() || item.creative,
    purchaseOrder: item.purchaseOrder?.toObject?.() || item.purchaseOrder,
    mounting: item.mounting?.toObject?.() || item.mounting,
    proof: item.proof?.toObject?.() || item.proof,
    takedown: item.takedown?.toObject?.() || item.takedown,
    itemStatus: item.itemStatus,
    notes: item.notes,
  }));
  const proofUploadedCount = items.filter(
    (item: any) => item.proof?.uploaded && item.proof?.photoUrls?.length,
  ).length;

  return {
    generatedAt,
    operationCode: operation.operationCode,
    campaignCode: operation.campaignCode,
    campaignTitle: operation.campaignTitle,
    clientName: operation.clientName,
    planVersionLabel: operation.planVersionLabel,
    operationStatus: operation.status,
    operationOwnerName:
      operation.operationOwner?.name || operation.operationOwner?.email || 'Unassigned',
    notes: operation.notes,
    poNumber,
    partial: proofUploadedCount < items.length,
    proofUploadedCount,
    totalItems: items.length,
    mountedCount: items.filter((item: any) => item.mounting?.completed).length,
    items,
  };
};

const buildOperationHtml = (
  type: DocumentType,
  data: TemplateOperationData,
) => {
  if (type === 'WorkOrder') return buildWorkOrderHtml(data);
  if (type === 'PurchaseOrder') return buildPurchaseOrderHtml(data);
  return buildExecutionReportHtml(data);
};

@injectable()
export class DocumentService implements IDocumentService {
  constructor(
    @inject(TOKENS.DocumentRepository)
    private readonly documents: IDocumentRepository,
    @inject(TOKENS.PlanRepository)
    private readonly plans: IPlanRepository,
    @inject(TOKENS.OperationRepository)
    private readonly operations: IOperationRepository,
    @inject(TOKENS.OperationCounterRepository)
    private readonly operationCounters: IOperationCounterRepository,
    @inject(TOKENS.PdfService)
    private readonly pdf: PdfService,
  ) {}

  async generate(planId: string, requestedType: string, actorId: string) {
    this.validateId(planId, 'planId');
    if (!planDocumentTypes.includes(requestedType as DocumentType)) {
      throw new HttpError(400, 'documentType is invalid');
    }
    const documentType = requestedType as DocumentType;
    const plan = await this.plans.findByIdPopulated(planId);
    if (!plan) throw new HttpError(404, 'Plan not found');
    const campaign = plan.campaign as any;
    const generatedAt = new Date();
    const data = toTemplateData(plan, generatedAt);
    const fileName = buildDocumentFileName({
      campaignCode: data.campaignCode,
      planVersionLabel: data.planVersionLabel,
      documentType,
    });
    const pdfBuffer = await this.pdf.generatePdfFromHtml(buildHtml(documentType, data));
    const upload = await this.pdf.uploadPdf(pdfBuffer, fileName);

    try {
      const document = await this.documents.create({
        plan: plan._id,
        campaign: campaign._id,
        documentType,
        versionNumber: plan.versionNumber,
        fileName,
        filePath: `cloudinary:${upload.publicId}`,
        storageProvider: 'cloudinary',
        storageKey: upload.publicId,
        storageResourceType: upload.resourceType,
        storageDeliveryType: upload.deliveryType,
        storageFormat: upload.format,
        storageBytes: upload.bytes,
        generatedBy: new Types.ObjectId(actorId),
        generatedAt,
        metadata: {
          planVersionLabel: data.planVersionLabel,
          campaignCode: data.campaignCode,
          clientName: data.clientName,
          grandTotal: data.pricing.grandTotal,
        },
      });
      document.fileUrl = `/api/documents/${document._id.toString()}/download`;
      await this.documents.save(document);
      return mapDocument(await this.requireDocument(document._id.toString()));
    } catch (error) {
      await this.pdf.deletePdf(upload.publicId, upload.deliveryType).catch(() => undefined);
      throw error;
    }
  }

  async listByPlan(planId: string) {
    this.validateId(planId, 'planId');
    return (await this.documents.findByPlan(planId)).map(mapDocument);
  }

  async generateOperation(operationId: string, requestedType: string, actorId: string) {
    this.validateId(operationId, 'operationId');
    if (!operationDocumentTypes.includes(requestedType as DocumentType)) {
      throw new HttpError(400, 'documentType is invalid');
    }

    const documentType = requestedType as DocumentType;
    const operation = await this.operations.findByIdPopulated(operationId);
    if (!operation) throw new HttpError(404, 'Operation not found');
    if (!operation.items.length && documentType === 'PurchaseOrder') {
      throw new HttpError(400, 'Operation has no items');
    }

    const proofUploadedCount = operation.items.filter(
      (item: any) => item.proof?.uploaded && item.proof?.photoUrls?.length,
    ).length;
    if (documentType === 'ExecutionReport' && proofUploadedCount === 0) {
      throw new HttpError(
        400,
        'At least one proof photo is required before generating an execution report.',
      );
    }

    const generatedAt = new Date();
    let poNumber: string | undefined;
    if (documentType === 'PurchaseOrder') {
      const year = generatedAt.getFullYear();
      const counter = await this.operationCounters.incrementSequence(
        getPurchaseOrderCounterKey(year),
        year,
      );
      poNumber = formatPurchaseOrderNumber(year, counter.sequence);
    }

    const data = toOperationTemplateData(operation, generatedAt, poNumber);
    const fileName = buildDocumentFileName({
      campaignCode: data.campaignCode || data.operationCode,
      planVersionLabel: data.planVersionLabel || data.operationCode,
      documentType,
    });
    const pdfBuffer = await this.pdf.generatePdfFromHtml(
      buildOperationHtml(documentType, data),
    );
    const upload = await this.pdf.uploadPdf(pdfBuffer, fileName);
    const supplierNames = [
      ...new Set(
        data.items
          .map((item) => item.supplierName || item.ownerName)
          .filter((name): name is string => Boolean(name)),
      ),
    ];

    try {
      const document = await this.documents.create({
        plan: (operation.plan as any)?._id || operation.plan,
        campaign: (operation.campaign as any)?._id || operation.campaign,
        operation: operation._id,
        documentType,
        versionNumber: Number(
          String(operation.planVersionLabel || '').replace(/\D/g, ''),
        ) || 1,
        fileName,
        filePath: `cloudinary:${upload.publicId}`,
        storageProvider: 'cloudinary',
        storageKey: upload.publicId,
        storageResourceType: upload.resourceType,
        storageDeliveryType: upload.deliveryType,
        storageFormat: upload.format,
        storageBytes: upload.bytes,
        generatedBy: new Types.ObjectId(actorId),
        generatedAt,
        metadata: {
          planVersionLabel: data.planVersionLabel,
          campaignCode: data.campaignCode,
          campaignTitle: data.campaignTitle,
          clientName: data.clientName,
          operationCode: data.operationCode,
          supplierName:
            supplierNames.length > 1 ? 'Multiple Suppliers' : supplierNames[0],
          poNumber,
          partial: documentType === 'ExecutionReport' ? data.partial : undefined,
          grandTotal:
            documentType === 'PurchaseOrder'
              ? data.items.reduce(
                  (sum, item) => sum + (item.totalInternalCost || 0),
                  0,
                )
              : undefined,
        },
      });
      document.fileUrl = `/api/documents/${document._id.toString()}/download`;
      await this.documents.save(document);
      return mapDocument(await this.requireDocument(document._id.toString()));
    } catch (error) {
      await this.pdf.deletePdf(upload.publicId, upload.deliveryType).catch(() => undefined);
      throw error;
    }
  }

  async listByOperation(operationId: string) {
    this.validateId(operationId, 'operationId');
    return (await this.documents.findByOperation(operationId)).map(mapDocument);
  }

  async getDownload(id: string) {
    const document = await this.requireDocument(id);
    if (document.storageProvider === 'cloudinary' || document.filePath.startsWith('cloudinary:')) {
      const publicId = document.storageKey || document.filePath.replace(/^cloudinary:/, '');
      if (!publicId) throw new HttpError(404, 'Document file not found');
      return {
        fileName: document.fileName,
        remoteUrl: this.pdf.getDownloadUrl({
          publicId,
          format: document.storageFormat || 'pdf',
          deliveryType: document.storageDeliveryType || 'authenticated',
        }),
      };
    }

    const resolvedPath = path.resolve(document.filePath);
    const storageRoot = `${path.resolve(documentStoragePath)}${path.sep}`;
    if (!resolvedPath.startsWith(storageRoot)) {
      throw new HttpError(404, 'Document file not found');
    }
    try {
      await fs.access(resolvedPath);
    } catch {
      throw new HttpError(404, 'Document file not found');
    }
    return { fileName: document.fileName, filePath: resolvedPath };
  }

  private async requireDocument(id: string) {
    this.validateId(id, 'documentId');
    const document = await this.documents.findByIdPopulated(id);
    if (!document) throw new HttpError(404, 'Document not found');
    return document;
  }

  private validateId(id: string, field: string) {
    if (!Types.ObjectId.isValid(id)) throw new HttpError(400, `${field} is invalid`);
  }
}
