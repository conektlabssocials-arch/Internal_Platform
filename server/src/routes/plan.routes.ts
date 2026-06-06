import { Router } from 'express';

import { container } from '../config/container.js';
import { PlanController } from '../controllers/plan.controller.js';
import { AuthMiddleware } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const controller = container.resolve(PlanController);
const auth = container.resolve(AuthMiddleware);

router.use(auth.requireAuth);
router.get('/', asyncHandler(controller.listRecent));
router.post('/:id/clone', asyncHandler(controller.clone));
router.get('/:id', asyncHandler(controller.detail));
router.patch('/:id', asyncHandler(controller.update));
router.patch('/:id/status', asyncHandler(controller.status));
router.delete('/:id', auth.requireAdmin, asyncHandler(controller.delete));

export default router;
