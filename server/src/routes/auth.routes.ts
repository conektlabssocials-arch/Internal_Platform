import { Router } from 'express';

import { container } from '../config/container.js';
import { AuthController } from '../controllers/auth.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const authController = container.resolve(AuthController);

router.post('/google', asyncHandler(authController.postGoogleLogin));
router.post('/logout', asyncHandler(authController.postLogout));
router.get('/me', asyncHandler(authController.getMe));

export default router;
