import { inject, injectable } from 'tsyringe';
import type { Request, Response } from 'express';

import { TOKENS } from '../config/tokens.js';
import type { IUploadService } from '../services/upload.service.js';
import { HttpError } from '../utils/httpError.js';

@injectable()
export class UploadController {
  constructor(
    @inject(TOKENS.UploadService)
    private readonly uploadService: IUploadService,
  ) {}

  uploadImages = async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[] | undefined) || [];

    if (files.length === 0) {
      throw new HttpError(400, 'No image files were provided');
    }

    const uploads = await Promise.all(
      files.map((file) =>
        this.uploadService.uploadImage({ buffer: file.buffer, mimetype: file.mimetype }),
      ),
    );

    res.status(201).json({ data: uploads });
  };
}
