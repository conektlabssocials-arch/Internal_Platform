import multer from 'multer';
import type { RequestHandler } from 'express';

import { HttpError } from '../utils/httpError.js';

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const csvMimeTypes = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
]);

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_IMPORT_BYTES },
  fileFilter: (_req, file, callback) => {
    const hasCsvExtension = file.originalname.toLowerCase().endsWith('.csv');
    if (!hasCsvExtension || !csvMimeTypes.has(file.mimetype)) {
      callback(new HttpError(400, 'Only CSV files are supported'));
      return;
    }
    callback(null, true);
  },
}).single('file');

export const importCsvUpload: RequestHandler = (req, res, next) => {
  csvUpload(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? 'CSV files cannot exceed 10 MB'
          : error.message;
      next(new HttpError(413, message));
      return;
    }
    next(error);
  });
};
