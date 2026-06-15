import { Router } from 'express';

import { container } from '../config/container.js';
import { UploadController } from '../controllers/upload.controller.js';
import { AuthMiddleware } from '../middleware/auth.middleware.js';
import { uploadFiles } from '../middleware/upload.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const controller = container.resolve(UploadController);
const auth = container.resolve(AuthMiddleware);

router.use(auth.requireAuth);
router.get('/', asyncHandler(controller.list));
router.post(
  '/image',
  auth.requirePermission('uploads.manage'),
  uploadFiles('inventory_photo'),
  asyncHandler(controller.uploadImages),
);
router.post(
  '/inventory/:inventoryId/photos',
  auth.requirePermission('uploads.manage'),
  uploadFiles('inventory_photo'),
  asyncHandler(controller.inventoryPhotos),
);
router.post(
  '/operations/:operationId/items/:itemId/creative',
  auth.requirePermission('uploads.manage'),
  uploadFiles('creative'),
  asyncHandler(controller.creative),
);
router.post(
  '/operations/:operationId/items/:itemId/po',
  auth.requirePermission('uploads.manage'),
  uploadFiles('purchase_order'),
  asyncHandler(controller.purchaseOrder),
);
router.post(
  '/operations/:operationId/items/:itemId/proof',
  auth.requirePermission('uploads.manage'),
  uploadFiles('proof'),
  asyncHandler(controller.proof),
);
router.get('/:uploadId', asyncHandler(controller.detail));
router.get('/:uploadId/download', asyncHandler(controller.download));
router.delete('/:uploadId', auth.requireAdmin, asyncHandler(controller.delete));

export default router;
