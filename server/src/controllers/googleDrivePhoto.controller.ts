import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { IGoogleDrivePhotoService } from '../services/googleDrivePhoto.service.js';
import { HttpError } from '../utils/httpError.js';

@injectable()
export class GoogleDrivePhotoController {
  constructor(
    @inject(TOKENS.GoogleDrivePhotoService)
    private readonly service: IGoogleDrivePhotoService,
  ) {}

  image = async (req: Request, res: Response) => {
    try {
      const image = await this.service.getImageFile(req.params.fileId, req.query.size);
      res.setHeader('Content-Type', image.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // These are public images embedded as <img> from the client app, which in
      // development runs on a different origin (port). Helmet defaults to
      // `Cross-Origin-Resource-Policy: same-origin`, which makes the browser
      // refuse to render the (otherwise 200) response cross-origin. Allow it.
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.status(200).send(image.buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google Drive image failed';
      throw new HttpError(404, message);
    }
  };
}
