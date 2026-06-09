import { Router } from 'express';

import { container } from '../config/container.js';
import { DashboardController } from '../controllers/dashboard.controller.js';
import { AuthMiddleware } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const controller = container.resolve(DashboardController);
const auth = container.resolve(AuthMiddleware);

router.use(auth.requireAuth);
router.get('/overview', asyncHandler(controller.overview));
router.get('/my-work', asyncHandler(controller.myWork));
router.get('/campaigns', asyncHandler(controller.campaigns));
router.get('/plans', asyncHandler(controller.plans));
router.get('/inventory', asyncHandler(controller.inventory));
router.get('/operations', asyncHandler(controller.operations));

export default router;
