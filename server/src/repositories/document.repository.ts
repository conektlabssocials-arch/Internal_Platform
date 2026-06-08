import { injectable } from 'tsyringe';

import { BaseRepository } from './base.repository.js';
import type { IBaseRepository } from './base.repository.js';
import { DocumentModel } from '../models/document.model.js';
import type { DocumentDocument } from '../models/document.model.js';

const populateDocument = (query: any) =>
  query.populate('generatedBy', 'name email role');

export interface IDocumentRepository extends IBaseRepository<DocumentDocument> {
  findByPlan(planId: string): Promise<DocumentDocument[]>;
  findByOperation(operationId: string): Promise<DocumentDocument[]>;
  findByIdPopulated(id: string): Promise<DocumentDocument | null>;
}

@injectable()
export class DocumentRepository
  extends BaseRepository<DocumentDocument>
  implements IDocumentRepository
{
  constructor() {
    super(DocumentModel);
  }

  findByPlan(planId: string) {
    return populateDocument(
      this.model.find({ plan: planId }).sort({ generatedAt: -1 }),
    ).exec() as Promise<DocumentDocument[]>;
  }

  findByOperation(operationId: string) {
    return populateDocument(
      this.model.find({ operation: operationId }).sort({ generatedAt: -1 }),
    ).exec() as Promise<DocumentDocument[]>;
  }

  findByIdPopulated(id: string) {
    return populateDocument(this.model.findById(id)).exec() as Promise<DocumentDocument | null>;
  }
}
