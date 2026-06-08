import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { IDocumentService } from '../services/document.service.js';
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
  ) {}

  generate = async (req: Request, res: Response) => {
    const data = await this.service.generate(
      req.params.planId,
      req.body.documentType,
      authUser(res.locals).userId,
    );
    res.status(201).json({ data });
  };

  listByPlan = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.listByPlan(req.params.planId) });
  };

  download = async (req: Request, res: Response) => {
    const file = await this.service.getDownload(req.params.documentId);
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
