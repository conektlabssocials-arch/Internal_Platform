import { Router } from 'express';

import { container } from '../config/container.js';
import { GoogleDrivePhotoController } from '../controllers/googleDrivePhoto.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const controller = container.resolve(GoogleDrivePhotoController);

router.get('/:fileId', asyncHandler(controller.image));

export default router;
