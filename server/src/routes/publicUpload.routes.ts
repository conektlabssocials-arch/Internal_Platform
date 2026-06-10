import { Router } from 'express';

import { container } from '../config/container.js';
import { UploadController } from '../controllers/upload.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const controller = container.resolve(UploadController);

router.get('/:uploadId', asyncHandler(controller.publicDownload));

export default router;
