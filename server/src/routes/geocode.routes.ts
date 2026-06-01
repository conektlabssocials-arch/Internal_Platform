import { Router } from 'express';

import { container } from '../config/container.js';
import { GeocodeController } from '../controllers/geocode.controller.js';
import { AuthMiddleware } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const geocodeController = container.resolve(GeocodeController);
const authMiddleware = container.resolve(AuthMiddleware);

router.use(authMiddleware.requireAuth);
router.get('/reverse', asyncHandler(geocodeController.reverseGeocode));

export default router;
