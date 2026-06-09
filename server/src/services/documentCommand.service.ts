import { inject, injectable } from 'tsyringe';
import type { Request } from 'express';

import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import { TOKENS } from '../config/tokens.js';
import type { DocumentType } from '../models/document.model.js';
import type { IActivityService } from './activity.service.js';
import type { CampaignCommandActor } from './campaignCommand.service.js';
import type { IDocumentService } from './document.service.js';
import type { IOperationService } from './operation.service.js';
import type { IPlanService } from './plan.service.js';
import { HttpError } from '../utils/httpError.js';

type DocumentDto = {
  id: string;
  plan: string;
  operation?: string;
  documentType: DocumentType;
  fileName: string;
  metadata?: Record<string, unknown>;
};

export type GenerateDocumentInput = {
  documentType: DocumentType;
  expectedUpdatedAt?: string;
};

export interface IDocumentCommandService {
  generatePlanDocument(
    planId: string,
    input: GenerateDocumentInput,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<DocumentDto>;
  generateOperationDocument(
    operationId: string,
    input: GenerateDocumentInput,
    actor: CampaignCommandActor,
    req?: Request,
  ): Promise<DocumentDto>;
}

const timestamp = (value?: Date | string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.getTime();
};

@injectable()
export class DocumentCommandService implements IDocumentCommandService {
  constructor(
    @inject(TOKENS.DocumentService)
    private readonly documents: IDocumentService,
    @inject(TOKENS.PlanService)
    private readonly plans: IPlanService,
    @inject(TOKENS.OperationService)
    private readonly operations: IOperationService,
    @inject(TOKENS.ActivityService)
    private readonly activity: IActivityService,
  ) {}

  async generatePlanDocument(
    planId: string,
    input: GenerateDocumentInput,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    const plan = (await this.plans.getById(planId)) as {
      updatedAt?: Date | string;
    };
    this.assertFresh(plan.updatedAt, input.expectedUpdatedAt, 'Plan');
    if (
      input.documentType === 'InternalCostSheet' &&
      actor.role !== 'admin'
    ) {
      throw new HttpError(
        403,
        'Only Admin can generate an Internal Cost Sheet through MCP',
      );
    }

    const data = (await this.documents.generate(
      planId,
      input.documentType,
      actor.userId,
    )) as DocumentDto;

    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.DOCUMENT_GENERATED,
      entityType: 'Document',
      entityId: data.id,
      entityCode: data.metadata?.campaignCode as string | undefined,
      entityTitle: data.fileName,
      parentEntityType: 'Plan',
      parentEntityId: data.plan,
      message: `${data.documentType} PDF was generated.`,
      metadata: {
        documentType: data.documentType,
        fileName: data.fileName,
        ...data.metadata,
      },
      req,
    });

    return data;
  }

  async generateOperationDocument(
    operationId: string,
    input: GenerateDocumentInput,
    actor: CampaignCommandActor,
    req?: Request,
  ) {
    const operation = (await this.operations.getById(operationId)) as {
      updatedAt?: Date | string;
    };
    this.assertFresh(operation.updatedAt, input.expectedUpdatedAt, 'Operation');

    const data = (await this.documents.generateOperation(
      operationId,
      input.documentType,
      actor.userId,
    )) as DocumentDto;

    await this.activity.logEntityActivity({
      actor,
      action: ACTIVITY_ACTIONS.DOCUMENT_GENERATED,
      entityType: 'Document',
      entityId: data.id,
      entityCode: data.metadata?.operationCode as string | undefined,
      entityTitle: data.fileName,
      parentEntityType: 'Operation',
      parentEntityId: data.operation,
      message: `${data.documentType} PDF was generated.`,
      metadata: {
        documentType: data.documentType,
        fileName: data.fileName,
        ...data.metadata,
      },
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
        `${entity} changed since it was read. Read it again before generating the document.`,
      );
    }
  }
}
