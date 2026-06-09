import { Router } from 'express';
import { container } from '../config/container.js';
import { ActivityController } from '../controllers/activity.controller.js';
import { AuthMiddleware } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const controller = container.resolve(ActivityController);
const auth = container.resolve(AuthMiddleware);
router.use(auth.requireAuth);
router.get('/audit', auth.requireAdmin, asyncHandler(controller.audit));
router.get('/entity/:entityType/:entityId', asyncHandler(controller.entity));
router.get('/', asyncHandler(controller.list));
export default router;
