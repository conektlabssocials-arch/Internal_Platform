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
router.post('/sync-from-plan/:planId', asyncHandler(controller.syncFromPlan));
router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.detail));
router.patch('/:id', asyncHandler(controller.update));
router.patch('/:id/status', asyncHandler(controller.status));
router.patch('/:id/items/:itemId', asyncHandler(controller.item));
router.patch('/:id/items/:itemId/creative', asyncHandler(controller.creative));
router.patch('/:id/items/:itemId/po', asyncHandler(controller.purchaseOrder));
router.patch('/:id/items/:itemId/mounting', asyncHandler(controller.mounting));
router.patch('/:id/items/:itemId/proof', asyncHandler(controller.proof));
router.patch('/:id/items/:itemId/takedown', asyncHandler(controller.takedown));

export default router;
