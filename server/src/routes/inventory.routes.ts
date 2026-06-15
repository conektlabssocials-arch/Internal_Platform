import { Router } from 'express';

import { container } from '../config/container.js';
import { InventoryController } from '../controllers/inventory.controller.js';
import { AuthMiddleware } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const inventoryController = container.resolve(InventoryController);
const authMiddleware = container.resolve(AuthMiddleware);

router.use(authMiddleware.requireAuth);

router.get('/summary', asyncHandler(inventoryController.getInventorySummary));
router.get('/preview-code', asyncHandler(inventoryController.getPreviewCode));
router.get('/', asyncHandler(inventoryController.getInventory));
router.get('/:id', asyncHandler(inventoryController.getInventoryById));
router.post(
  '/',
  authMiddleware.requirePermission('inventory.create'),
  asyncHandler(inventoryController.postInventory),
);
router.patch(
  '/:id',
  authMiddleware.requirePermission('inventory.edit'),
  asyncHandler(inventoryController.patchInventory),
);
router.patch(
  '/:id/deactivate',
  authMiddleware.requireAdmin,
  asyncHandler(inventoryController.deactivateInventory),
);
router.patch(
  '/:id/activate',
  authMiddleware.requireAdmin,
  asyncHandler(inventoryController.activateInventory),
);
router.patch(
  '/:id/confirm',
  authMiddleware.requirePermission('inventory.confirm'),
  asyncHandler(inventoryController.confirmInventory),
);

export default router;
