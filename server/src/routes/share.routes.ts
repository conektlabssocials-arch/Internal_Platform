import { Router } from 'express';

import { container } from '../config/container.js';
import { ShareController } from '../controllers/share.controller.js';
import { AuthMiddleware } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const controller = container.resolve(ShareController);
const auth = container.resolve(AuthMiddleware);

router.use(auth.requireAuth);
router.post('/plans/:planId', auth.requirePermission('shares.manage'), asyncHandler(controller.create));
router.get('/plans/:planId', asyncHandler(controller.listByPlan));
router.patch('/:shareId/disable', auth.requirePermission('shares.manage'), asyncHandler(controller.disable));

export default router;
