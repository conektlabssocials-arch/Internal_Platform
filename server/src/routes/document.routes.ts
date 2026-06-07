import { Router } from 'express';

import { container } from '../config/container.js';
import { DocumentController } from '../controllers/document.controller.js';
import { AuthMiddleware } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const controller = container.resolve(DocumentController);
const auth = container.resolve(AuthMiddleware);

router.use(auth.requireAuth);
router.post('/plans/:planId/generate', asyncHandler(controller.generate));
router.get('/plans/:planId', asyncHandler(controller.listByPlan));
router.get('/:documentId/download', asyncHandler(controller.download));

export default router;
