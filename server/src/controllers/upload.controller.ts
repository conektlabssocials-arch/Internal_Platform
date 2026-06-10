import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { IUploadService } from '../services/upload.service.js';
import type { AuthTokenPayload } from '../types/auth.js';
import { HttpError } from '../utils/httpError.js';

const actor = (locals: { authUser?: AuthTokenPayload }) => {
  if (!locals.authUser) throw new HttpError(401, 'Authentication required');
  return locals.authUser;
};
const files = (req: Request) =>
  (req.files as Express.Multer.File[] | undefined) || [];

@injectable()
export class UploadController {
  constructor(
    @inject(TOKENS.UploadService)
    private readonly service: IUploadService,
  ) {}

  uploadImages = async (req: Request, res: Response) => {
    const uploads = await Promise.all(
      files(req).map((file) =>
        this.service.uploadImage({
          buffer: file.buffer,
          mimetype: file.mimetype,
          fileName: file.originalname,
        }),
      ),
    );
    res.status(201).json({ data: uploads });
  };

  inventoryPhotos = async (req: Request, res: Response) => {
    const data = await this.service.uploadInventoryPhotos(
      req.params.inventoryId,
      files(req),
      actor(res.locals),
      req,
    );
    res.status(201).json({ data });
  };

  creative = async (req: Request, res: Response) => {
    const data = await this.service.uploadOperationFiles(
      req.params.operationId,
      req.params.itemId,
      'creative',
      files(req),
      actor(res.locals),
      req,
    );
    res.status(201).json({ data });
  };

  purchaseOrder = async (req: Request, res: Response) => {
    const data = await this.service.uploadOperationFiles(
      req.params.operationId,
      req.params.itemId,
      'purchase_order',
      files(req),
      actor(res.locals),
      req,
    );
    res.status(201).json({ data });
  };

  proof = async (req: Request, res: Response) => {
    const data = await this.service.uploadOperationFiles(
      req.params.operationId,
      req.params.itemId,
      'proof',
      files(req),
      actor(res.locals),
      req,
    );
    res.status(201).json({ data });
  };

  list = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.list(req.query as any) });
  };

  detail = async (req: Request, res: Response) => {
    res.status(200).json({ data: await this.service.get(req.params.uploadId) });
  };

  download = async (req: Request, res: Response) => {
    const file = await this.service.getInternalDownload(req.params.uploadId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.redirect(file.url);
  };

  publicDownload = async (req: Request, res: Response) => {
    const file = await this.service.getPublicDownload(req.params.uploadId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.redirect(file.url);
  };

  delete = async (req: Request, res: Response) => {
    await this.service.delete(req.params.uploadId, actor(res.locals), req);
    res.status(200).json({ message: 'Upload deleted' });
  };
}
