import { Router } from 'express';
import type { AuthHandlers } from './auth.handlers.js';
import { validateBody, validateParams } from '../shared/middleware/validation.middleware.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  updateProfileSchema,
  deactivateAccountSchema,
  assignManagerSchema,
  updateUserRoleSchema,
  userIdParamsSchema,
} from './auth.schemas.js';

export function createAuthRoutes(authHandlers: AuthHandlers): Router {
  const router = Router();

  // Authentication routes
  router.post('/register', validateBody(registerSchema), authHandlers.registerUser);
  router.post('/login', validateBody(loginSchema), authHandlers.loginUser);
  router.post('/refresh', validateBody(refreshTokenSchema), authHandlers.refreshToken);

  // Protected user routes
  router.put(
    '/users/:userId/password',
    validateParams(userIdParamsSchema),
    validateBody(changePasswordSchema),
    authHandlers.changePassword
  );

  router.put(
    '/users/:userId/profile',
    validateParams(userIdParamsSchema),
    validateBody(updateProfileSchema),
    authHandlers.updateProfile
  );

  router.get(
    '/users/:userId/profile',
    validateParams(userIdParamsSchema),
    authHandlers.getUserProfile
  );

  router.delete(
    '/users/:userId',
    validateParams(userIdParamsSchema),
    validateBody(deactivateAccountSchema),
    authHandlers.deactivateAccount
  );

  // Manager routes
  router.put(
    '/users/:userId/manager',
    validateParams(userIdParamsSchema),
    validateBody(assignManagerSchema),
    authHandlers.assignManager
  );

  router.get(
    '/managers/:managerId/users',
    validateParams(userIdParamsSchema),
    authHandlers.getUsersByManager
  );

  router.put(
    '/users/:userId/role',
    validateParams(userIdParamsSchema),
    validateBody(updateUserRoleSchema),
    authHandlers.updateUserRole
  );

  return router;
} 