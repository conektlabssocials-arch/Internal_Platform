import { Router } from 'express';

import { container } from '../config/container.js';
import { ShareController } from '../controllers/share.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const controller = container.resolve(ShareController);

router.get('/:token', asyncHandler(controller.publicDetail));
router.post('/:token/track', asyncHandler(controller.trackPublic));

export default router;
