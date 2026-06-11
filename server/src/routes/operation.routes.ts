import { Router } from 'express';

import { container } from '../config/container.js';
import { OperationController } from '../controllers/operation.controller.js';
import { AuthMiddleware } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const controller = container.resolve(OperationController);
const auth = container.resolve(AuthMiddleware);

router.use(auth.requireAuth);
router.get('/summary', asyncHandler(controller.summary));
router.get('/by-plan/:planId', asyncHandler(controller.byPlan));
router.post('/sync-from-plan/:planId', auth.requirePermission('operations.manage'), asyncHandler(controller.syncFromPlan));
router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.detail));
router.patch('/:id', auth.requirePermission('operations.manage'), asyncHandler(controller.update));
router.patch('/:id/status', auth.requirePermission('operations.manage'), asyncHandler(controller.status));
router.patch('/:id/items/:itemId', auth.requirePermission('operations.manage'), asyncHandler(controller.item));
router.patch('/:id/items/:itemId/creative', auth.requirePermission('operations.manage'), asyncHandler(controller.creative));
router.patch('/:id/items/:itemId/po', auth.requirePermission('operations.manage'), asyncHandler(controller.purchaseOrder));
router.patch('/:id/items/:itemId/mounting', auth.requirePermission('operations.manage'), asyncHandler(controller.mounting));
router.patch('/:id/items/:itemId/proof', auth.requirePermission('operations.manage'), asyncHandler(controller.proof));
router.patch('/:id/items/:itemId/takedown', auth.requirePermission('operations.manage'), asyncHandler(controller.takedown));

export default router;
