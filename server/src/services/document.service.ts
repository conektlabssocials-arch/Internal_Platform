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
import type { IGoogleDrivePhotoService } from './googleDrivePhoto.service.js';
import { buildExecutionReportHtml } from '../templates/executionReport.template.js';
import { buildInternalCostSheetHtml } from '../templates/internalCostSheet.template.js';
import { buildPlanProposalHtml } from '../templates/planProposal.template.js';
import {
  buildPlanProposalV2Html,
  buildPlanProposalV2FrontHtml,
  buildPlanProposalV2SitePagesHtml,
} from '../templates/planProposalV2.template.js';
import { buildPlanDataSheetWorkbook } from '../templates/planDataSheet.template.js';
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
  'PlanDataSheet',
  'Quotation',
  'InternalCostSheet',
];
const operationDocumentTypes: DocumentType[] = [
  'WorkOrder',
  'PurchaseOrder',
  'ExecutionReport',
];

// Cap the number of full-page (photo) site profiles in a V2 proposal. Every item
// is still listed in the inventory summary table; this only limits the detailed
// per-site pages so the PDF stays within the storage size limit for huge plans.
// Tunable via env for accounts with a larger upload cap.
const MAX_V2_SITE_PAGES = Math.max(1, Number(process.env.DOCUMENT_MAX_SITE_PAGES) || 80);

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
  status: document.status || 'ready',
  progress: document.progress ?? 0,
  error: document.error,
  generatedBy: ref(document.generatedBy),
  generatedAt: document.generatedAt,
  metadata: document.metadata,
  createdAt: document.createdAt,
});

const getClientName = (campaign: any) =>
  campaign.client?.displayName || campaign.client?.name || 'Client';

// Stored plan photos are raw Google Drive URLs, which an <img> tag cannot load
// directly (Google serves an HTML/redirect page, not image bytes). Extract the
// Drive file id so we can fetch the bytes server-side and inline them.
const driveFileIdPatterns = [
  /drive\.google\.com\/uc\?(?:.*&)?id=([^&]+)/,
  /drive\.google\.com\/file\/d\/([^/?]+)/,
  /drive\.google\.com\/open\?(?:.*&)?id=([^&]+)/,
  /drive\.usercontent\.google\.com\/download\?(?:.*&)?id=([^&]+)/,
];

const extractDriveFileId = (url?: string) => {
  if (!url) return undefined;
  for (const pattern of driveFileIdPatterns) {
    const match = url.match(pattern);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return undefined;
};

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
      illumination: item.illumination ?? inventory?.illumination,
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
    @inject(TOKENS.GoogleDrivePhotoService)
    private readonly driveImages: IGoogleDrivePhotoService,
  ) {}

  // Inline the first photo of each item as a base64 data URI so the PDF renderer
  // (puppeteer) gets real image bytes instead of a Drive URL it cannot load.
  // Processed in bounded batches so a large plan (1000+ items) doesn't fire that
  // many concurrent Drive fetches at once (which triggers Google 429s and large
  // memory spikes).
  private async inlineItemPhotos(
    items: TemplatePlanData['items'],
    onProgress?: (fraction: number) => Promise<void> | void,
  ) {
    const concurrency = 8;
    const total = items.length;
    let processed = 0;
    for (let start = 0; start < total; start += concurrency) {
      const batch = items.slice(start, start + concurrency);
      await Promise.all(
        batch.map(async (item) => {
          const photo = item.photos?.find(Boolean);
          const fileId = extractDriveFileId(photo);
          if (!fileId) {
            // Non-Drive URLs (already a direct image) are left as-is.
            item.photos = photo ? [photo] : [];
            return;
          }
          try {
            const { buffer, contentType } = await this.driveImages.getImageFile(fileId, 800);
            item.photos = [`data:${contentType};base64,${buffer.toString('base64')}`];
          } catch {
            // Leave empty so the template falls back to the placeholder graphic.
            item.photos = [];
          }
        }),
      );
      processed += batch.length;
      await onProgress?.(total ? processed / total : 1);
    }
  }

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
    // Building the template data is cheap; the expensive work (fetching photos,
    // rendering the PDF, uploading) can take minutes for large plans, so it runs
    // in the background and the request returns a `processing` record straight away.
    const data = toTemplateData(plan, generatedAt);
    const fileName = buildDocumentFileName({
      campaignCode: data.campaignCode,
      planVersionLabel: data.planVersionLabel,
      documentType,
      extension: documentType === 'PlanDataSheet' ? 'xlsx' : 'pdf',
    });

    const document = await this.documents.create({
      plan: plan._id,
      campaign: campaign._id,
      documentType,
      versionNumber: plan.versionNumber,
      fileName,
      filePath: '',
      status: 'processing',
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

    const documentId = document._id.toString();
    // Detached on purpose: the HTTP response returns now and the client polls the
    // document list until the status flips to `ready` or `failed`.
    void this.runPlanGeneration(documentId, documentType, fileName, data);

    return mapDocument(await this.requireDocument(documentId));
  }

  // Renders the plan PDF. A single Chrome page cannot hold a 1000+ page V2
  // proposal (each page carries an inlined image) — it crashes with "Target
  // closed". So for large V2 plans we render the front matter and site pages in
  // bounded chunks (each its own short-lived browser) and merge the PDFs.
  private async renderPlanPdf(
    documentType: DocumentType,
    data: TemplatePlanData,
    onRenderProgress: (fraction: number) => Promise<void>,
  ): Promise<Buffer> {
    const CHUNK_SIZE = 50;
    // Site (photo) pages are capped; every item still appears in the summary table.
    const siteItems = data.items.slice(0, MAX_V2_SITE_PAGES);

    // Small, uncapped V2 plan → render in one pass.
    if (
      documentType !== 'PlanProposalV2' ||
      (siteItems.length === data.items.length && siteItems.length <= CHUNK_SIZE)
    ) {
      const buffer = await this.pdf.generatePdfFromHtml(buildHtml(documentType, data));
      await onRenderProgress(1);
      return buffer;
    }

    const buffers: Buffer[] = [
      await this.pdf.generatePdfFromHtml(buildPlanProposalV2FrontHtml(data, siteItems.length)),
    ];
    const chunkCount = Math.ceil(siteItems.length / CHUNK_SIZE);
    for (let i = 0; i < chunkCount; i += 1) {
      const start = i * CHUNK_SIZE;
      const chunk = siteItems.slice(start, start + CHUNK_SIZE);
      buffers.push(
        await this.pdf.generatePdfFromHtml(buildPlanProposalV2SitePagesHtml(chunk, start)),
      );
      await onRenderProgress((i + 1) / chunkCount);
    }
    return this.pdf.mergePdfs(buffers);
  }

  private async runPlanGeneration(
    documentId: string,
    documentType: DocumentType,
    fileName: string,
    data: TemplatePlanData,
  ) {
    // Stage budget for the progress bar: photos 5-70%, render 70-90%, upload 90-99%.
    let lastWritten = 0;
    const setProgress = async (value: number) => {
      const progress = Math.min(99, Math.max(0, Math.round(value)));
      if (progress <= lastWritten) return;
      lastWritten = progress;
      const document = await this.documents.findById(documentId).catch(() => null);
      if (document && document.status === 'processing') {
        document.progress = progress;
        await this.documents.save(document).catch(() => undefined);
      }
    };

    try {
      await setProgress(3);
      let outputBuffer: Buffer;
      if (documentType === 'PlanDataSheet') {
        // Spreadsheet export: just data + Drive links, so it's fast and tiny —
        // no puppeteer, no image fetching.
        await setProgress(30);
        outputBuffer = await buildPlanDataSheetWorkbook(data);
      } else {
        if (documentType === 'PlanProposalV2') {
          // Only the items that get a detailed photo page need their images fetched.
          await this.inlineItemPhotos(data.items.slice(0, MAX_V2_SITE_PAGES), (fraction) =>
            setProgress(5 + fraction * 65),
          );
        }
        await setProgress(72);
        outputBuffer = await this.renderPlanPdf(documentType, data, (fraction) =>
          setProgress(72 + fraction * 18),
        );
      }
      await setProgress(90);
      const upload = await this.pdf.uploadPdf(outputBuffer, fileName);

      const document = await this.documents.findById(documentId);
      if (!document) {
        // Record was deleted while generating; drop the orphaned upload.
        await this.pdf.deletePdf(upload.publicId, upload.deliveryType).catch(() => undefined);
        return;
      }
      document.filePath = `cloudinary:${upload.publicId}`;
      document.storageProvider = 'cloudinary';
      document.storageKey = upload.publicId;
      document.storageResourceType = upload.resourceType;
      document.storageDeliveryType = upload.deliveryType;
      document.storageFormat = upload.format;
      document.storageBytes = upload.bytes;
      document.status = 'ready';
      document.progress = 100;
      document.error = undefined;
      await this.documents.save(document);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Document generation failed';
      // Log the full error so the cause is findable in the server logs, not just
      // the short message stored on the record.
      console.error('[document] generation failed', {
        documentId,
        documentType,
        itemCount: data.items.length,
        error,
      });
      const document = await this.documents.findById(documentId).catch(() => null);
      if (document) {
        document.status = 'failed';
        document.error = message;
        await this.documents.save(document).catch(() => undefined);
      }
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
    if (document.status === 'processing') {
      throw new HttpError(409, 'Document is still being generated');
    }
    if (document.status === 'failed') {
      throw new HttpError(422, document.error || 'Document generation failed');
    }
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
