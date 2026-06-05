import { Router } from 'express';
import multer from 'multer';

import { container } from '../config/container.js';
import { UploadController } from '../controllers/upload.controller.js';
import { AuthMiddleware } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const uploadController = container.resolve(UploadController);
const authMiddleware = container.resolve(AuthMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

router.use(authMiddleware.requireAuth);

router.post('/image', upload.array('files', 10), asyncHandler(uploadController.uploadImages));

export default router;
