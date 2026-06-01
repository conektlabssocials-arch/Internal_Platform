import { Router } from 'express';

import { container } from '../config/container.js';
import { InventoryController } from '../controllers/inventory.controller.js';
import { AuthMiddleware } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const inventoryController = container.resolve(InventoryController);
const authMiddleware = container.resolve(AuthMiddleware);

router.use(authMiddleware.requireAuth);

router.get('/', asyncHandler(inventoryController.getInventory));
router.get('/preview-code', asyncHandler(inventoryController.getPreviewCode));
router.get('/:id', asyncHandler(inventoryController.getInventoryById));
router.post('/', asyncHandler(inventoryController.postInventory));
router.patch('/:id', asyncHandler(inventoryController.patchInventory));
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
router.patch('/:id/confirm', asyncHandler(inventoryController.confirmInventory));

export default router;
