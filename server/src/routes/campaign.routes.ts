import { Router } from 'express';

import { container } from '../config/container.js';
import { CampaignController } from '../controllers/campaign.controller.js';
import { PlanController } from '../controllers/plan.controller.js';
import { AuthMiddleware } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const controller = container.resolve(CampaignController);
const planController = container.resolve(PlanController);
const auth = container.resolve(AuthMiddleware);

router.use(auth.requireAuth);
router.get('/summary', asyncHandler(controller.summary));
router.get('/preview-code', asyncHandler(controller.preview));
router.get('/:campaignId/plans', asyncHandler(planController.listByCampaign));
router.post('/:campaignId/plans', asyncHandler(planController.create));
router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.detail));
router.post('/', asyncHandler(controller.create));
router.patch('/:id', asyncHandler(controller.update));
router.patch('/:id/status', asyncHandler(controller.status));

export default router;
