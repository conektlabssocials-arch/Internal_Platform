import fs from 'node:fs/promises';
import path from 'node:path';
import { inject, injectable } from 'tsyringe';
import { Types } from 'mongoose';

import { TOKENS } from '../config/tokens.js';
import { documentTypes } from '../models/document.model.js';
import type { DocumentDocument, DocumentType } from '../models/document.model.js';
import type { IDocumentRepository } from '../repositories/document.repository.js';
import type { IPlanRepository } from '../repositories/plan.repository.js';
import { buildInternalCostSheetHtml } from '../templates/internalCostSheet.template.js';
import { buildPlanProposalHtml } from '../templates/planProposal.template.js';
import { buildQuotationHtml } from '../templates/quotation.template.js';
import type { TemplatePlanData } from '../templates/template.utils.js';
import {
  buildDocumentFileName,
  documentStoragePath,
  ensureDocumentStorage,
  PdfService,
} from './pdf.service.js';
import { HttpError } from '../utils/httpError.js';

export interface IDocumentService {
  generate(planId: string, documentType: string, actorId: string): Promise<unknown>;
  listByPlan(planId: string): Promise<unknown[]>;
  getDownload(id: string): Promise<{ fileName: string; filePath: string }>;
}

const ref = (value: any) =>
  value && typeof value === 'object' && value._id
    ? { id: value._id.toString(), name: value.name || '', email: value.email }
    : undefined;

const mapDocument = (document: DocumentDocument) => ({
  id: document._id.toString(),
  plan: document.plan.toString(),
  campaign: document.campaign.toString(),
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
    items: (plan.items || []).map((item: any) => ({
      inventoryCode: item.inventoryCode,
      title: item.title,
      categoryGroup: item.categoryGroup,
      subCategory: item.subCategory,
      city: item.city,
      area: item.area,
      width: item.width,
      height: item.height,
      totalSqFt: item.totalSqFt,
      location: item.location
        ? {
            address: item.location.address,
            latitude: item.location.latitude,
            longitude: item.location.longitude,
          }
        : undefined,
      photos: item.photos || [],
      route: item.route,
      depot: item.depot,
      itinerary: item.itinerary,
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
    })),
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
  if (type === 'Quotation') return buildQuotationHtml(data);
  return buildInternalCostSheetHtml(data);
};

@injectable()
export class DocumentService implements IDocumentService {
  constructor(
    @inject(TOKENS.DocumentRepository)
    private readonly documents: IDocumentRepository,
    @inject(TOKENS.PlanRepository)
    private readonly plans: IPlanRepository,
    @inject(TOKENS.PdfService)
    private readonly pdf: PdfService,
  ) {}

  async generate(planId: string, requestedType: string, actorId: string) {
    this.validateId(planId, 'planId');
    if (!documentTypes.includes(requestedType as DocumentType)) {
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
    await ensureDocumentStorage();
    const filePath = path.join(documentStoragePath, fileName);

    await this.pdf.generatePdfFromHtml(buildHtml(documentType, data), filePath);

    try {
      const document = await this.documents.create({
        plan: plan._id,
        campaign: campaign._id,
        documentType,
        versionNumber: plan.versionNumber,
        fileName,
        filePath,
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
      await fs.unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

  async listByPlan(planId: string) {
    this.validateId(planId, 'planId');
    return (await this.documents.findByPlan(planId)).map(mapDocument);
  }

  async getDownload(id: string) {
    const document = await this.requireDocument(id);
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
