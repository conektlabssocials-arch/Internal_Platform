import type { RequestHandler } from 'express';
import multer from 'multer';

import {
  MAX_UPLOAD_REQUEST_BYTES,
  UPLOAD_RULES,
} from '../constants/upload.constants.js';
import type { UploadCategory } from '../models/upload.model.js';
import { HttpError } from '../utils/httpError.js';

const runMulter = (category: UploadCategory): RequestHandler => {
  const rule = UPLOAD_RULES[category];
  const middleware = multer({
    storage: multer.memoryStorage(),
    limits: {
      files: rule.maxFiles,
      fileSize: rule.maxFileBytes,
    },
    fileFilter: (_req, file, callback) => {
      if (!rule.allowedMimeTypes.includes(file.mimetype)) {
        callback(new HttpError(400, `${file.mimetype || 'File type'} is not supported`));
        return;
      }
      callback(null, true);
    },
  }).array('files', rule.maxFiles);

  return (req, res, next) => {
    middleware(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        const message =
          error.code === 'LIMIT_FILE_SIZE'
            ? `A file exceeds the ${Math.round(rule.maxFileBytes / 1024 / 1024)} MB limit`
            : error.code === 'LIMIT_FILE_COUNT'
              ? `A maximum of ${rule.maxFiles} files can be uploaded`
              : error.message;
        next(new HttpError(413, message));
        return;
      }
      if (error) {
        next(error);
        return;
      }

      const files = (req.files as Express.Multer.File[] | undefined) || [];
      try {
        validateUploadRequestTotal(files);
      } catch (validationError) {
        next(validationError);
        return;
      }
      next();
    });
  };
};

export const uploadFiles = (category: UploadCategory) => runMulter(category);

export const validateUploadRequestTotal = (
  files: Pick<Express.Multer.File, 'size'>[],
) => {
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_UPLOAD_REQUEST_BYTES) {
    throw new HttpError(413, 'The combined upload size cannot exceed 50 MB');
  }
};
