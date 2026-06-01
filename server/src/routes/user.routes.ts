import { Router } from 'express';

import { container } from '../config/container.js';
import { UserController } from '../controllers/user.controller.js';
import { AuthMiddleware } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const userController = container.resolve(UserController);
const authMiddleware = container.resolve(AuthMiddleware);

router.use(authMiddleware.requireAuth);

router.get('/', asyncHandler(userController.getUsers));
router.post('/', authMiddleware.requireAdmin, asyncHandler(userController.postUser));
router.patch('/:id', authMiddleware.requireAdmin, asyncHandler(userController.patchUser));
router.patch(
  '/:id/deactivate',
  authMiddleware.requireAdmin,
  asyncHandler(userController.deactivateUser),
);
router.patch('/:id/activate', authMiddleware.requireAdmin, asyncHandler(userController.activateUser));

export default router;
