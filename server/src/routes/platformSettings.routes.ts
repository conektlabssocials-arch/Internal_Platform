import { Router } from 'express';

import { container } from '../config/container.js';
import { PlatformSettingsController } from '../controllers/platformSettings.controller.js';
import { AuthMiddleware } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const controller = container.resolve(PlatformSettingsController);
const auth = container.resolve(AuthMiddleware);

router.use(auth.requireAuth);
router.get('/access', asyncHandler(controller.getAccess));
router.get('/', auth.requireAdmin, asyncHandler(controller.getSettings));
router.patch('/', auth.requireAdmin, asyncHandler(controller.updateSettings));

export default router;
