import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { IDocumentService } from '../services/document.service.js';
import type { IActivityService } from '../services/activity.service.js';
import { ACTIVITY_ACTIONS } from '../constants/activity.constants.js';
import type { AuthTokenPayload } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';

const authUser = (locals: { authUser?: AuthTokenPayload }) => {
  if (!locals.authUser) throw new HttpError(401, 'Authentication required');
  return locals.authUser;
};

@injectable()
export class DocumentController {
  constructor(
    @inject(TOKENS.DocumentService)
    private readonly service: IDocumentService,
    @inject(TOKENS.ActivityService)
    private readonly activity: IActivityService,
  ) {}

  generate = async (req: Request, res: Response) => {
    const actor = authUser(res.locals);
    const data: any = await this.service.generate(
      req.params.planId,
      req.body.documentType,
      actor.userId,
    );
    await this.activity.logEntityActivity({
      actor, action: ACTIVITY_ACTIONS.DOCUMENT_GENERATED, entityType: 'Document',
      entityId: data.id, entityCode: data.metadata?.campaignCode, entityTitle: data.fileName,
      parentEntityType: 'Plan', parentEntityId: data.plan,
      message: `${data.documentType} PDF was generated.`,
      metadata: { documentType: data.documentType, fileName: data.fileName, ...data.metadata }, req,
    });
    res.status(201).json({ data });
  };

  listByPlan = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.listByPlan(req.params.planId) });
  };

  generateOperation = async (req: Request, res: Response) => {
    const actor = authUser(res.locals);
    const data: any = await this.service.generateOperation(
      req.params.operationId,
      req.body.documentType,
      actor.userId,
    );
    await this.activity.logEntityActivity({
      actor, action: ACTIVITY_ACTIONS.DOCUMENT_GENERATED, entityType: 'Document',
      entityId: data.id, entityCode: data.metadata?.operationCode, entityTitle: data.fileName,
      parentEntityType: 'Operation', parentEntityId: data.operation,
      message: `${data.documentType} PDF was generated.`,
      metadata: { documentType: data.documentType, fileName: data.fileName, ...data.metadata }, req,
    });
    res.status(201).json({ data });
  };

  listByOperation = async (req: Request, res: Response) => {
    res.status(200).json({
      data: await this.service.listByOperation(req.params.operationId),
    });
  };

  download = async (req: Request, res: Response) => {
    const file = await this.service.getDownload(req.params.documentId);
    await this.activity.logEntityActivity({
      actor: authUser(res.locals), action: ACTIVITY_ACTIONS.DOCUMENT_DOWNLOADED,
      entityType: 'Document', entityId: req.params.documentId, entityTitle: file.fileName,
      message: `${file.fileName} was downloaded.`, visibility: 'admin_only', req,
    });
    if (file.remoteUrl) {
      const response = await fetch(file.remoteUrl);
      if (!response.ok) {
        throw new HttpError(502, 'Failed to download document from storage');
      }

      res.type('application/pdf');
      res.attachment(file.fileName);
      res.send(Buffer.from(await response.arrayBuffer()));
      return;
    }

    if (!file.filePath) throw new HttpError(404, 'Document file not found');
    res.type('application/pdf');
    res.download(file.filePath, file.fileName);
  };
}
