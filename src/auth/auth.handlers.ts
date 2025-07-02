import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import type { AuthService } from './auth.services.js';
import type { RequestWithCorrelation } from '../config/logger.js';
import { createAsyncErrorWrapper } from '../shared/middleware/error.middleware.js';

export type AuthHandlerDependencies = {
  authService: AuthService;
  logger: Logger;
};

export type AuthHandlers = {
  registerUser: (req: Request, res: Response, next: NextFunction) => void;
  loginUser: (req: Request, res: Response, next: NextFunction) => void;
  refreshToken: (req: Request, res: Response, next: NextFunction) => void;
  changePassword: (req: Request, res: Response, next: NextFunction) => void;
  updateProfile: (req: Request, res: Response, next: NextFunction) => void;
  getUserProfile: (req: Request, res: Response, next: NextFunction) => void;
  deactivateAccount: (req: Request, res: Response, next: NextFunction) => void;
  assignManager: (req: Request, res: Response, next: NextFunction) => void;
  getUsersByManager: (req: Request, res: Response, next: NextFunction) => void;
  updateUserRole: (req: Request, res: Response, next: NextFunction) => void;
};

function createAuthHandlers(dependencies: AuthHandlerDependencies): AuthHandlers {
  const { authService, logger } = dependencies;

  async function registerUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      logger.info({ correlationId, email: req.body.email }, 'Processing user registration');
      
      const user = await authService.registerUser(req.body);
      
      logger.info({ 
        correlationId, 
        userId: user.id, 
        email: user.email 
      }, 'User registration successful');
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: { user },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        email: req.body.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'User registration failed');
      
      next(error);
    }
  }

  async function loginUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      logger.info({ correlationId, email: req.body.email }, 'Processing user login');
      
      const result = await authService.loginUser(req.body);
      
      logger.info({ 
        correlationId, 
        userId: result.user.id, 
        email: result.user.email 
      }, 'User login successful');
      
      // Set HTTP-only cookie for refresh token (optional security enhancement)
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          // Don't send refresh token in body if using HTTP-only cookies
          ...(process.env.NODE_ENV !== 'production' && { 
            refreshToken: result.tokens.refreshToken 
          }),
        },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        email: req.body.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'User login failed');
      
      next(error);
    }
  }

  async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      // Get refresh token from cookie or body
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
      
      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token is required',
          correlationId,
        });
        return;
      }
      
      logger.debug({ correlationId }, 'Processing token refresh');
      
      const result = await authService.refreshToken({ refreshToken });
      
      logger.info({ 
        correlationId, 
        userId: result.user.id 
      }, 'Token refresh successful');
      
      // Update HTTP-only cookie with new refresh token
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      
      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          ...(process.env.NODE_ENV !== 'production' && { 
            refreshToken: result.tokens.refreshToken 
          }),
        },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Token refresh failed');
      
      next(error);
    }
  }

  async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    const userId = req.params.userId || (req as any).user?.userId;
    
    try {
      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
          correlationId,
        });
        return;
      }
      
      logger.info({ correlationId, userId }, 'Processing password change');
      
      await authService.changePassword(userId, req.body);
      
      logger.info({ correlationId, userId }, 'Password change successful');
      
      res.json({
        success: true,
        message: 'Password changed successfully',
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Password change failed');
      
      next(error);
    }
  }

  async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    const userId = req.params.userId || (req as any).user?.userId;
    
    try {
      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
          correlationId,
        });
        return;
      }
      
      logger.info({ correlationId, userId }, 'Processing profile update');
      
      const user = await authService.updateProfile(userId, req.body);
      
      logger.info({ correlationId, userId }, 'Profile update successful');
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Profile update failed');
      
      next(error);
    }
  }

  async function getUserProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    const userId = req.params.userId || (req as any).user?.userId;
    
    try {
      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
          correlationId,
        });
        return;
      }
      
      logger.debug({ correlationId, userId }, 'Fetching user profile');
      
      const user = await authService.getUserProfile(userId);
      
      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: { user },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Profile retrieval failed');
      
      next(error);
    }
  }

  async function deactivateAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    const userId = req.params.userId || (req as any).user?.userId;
    
    try {
      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
          correlationId,
        });
        return;
      }
      
      logger.info({ correlationId, userId }, 'Processing account deactivation');
      
      await authService.deactivateAccount(userId, req.body.reason);
      
      logger.info({ correlationId, userId }, 'Account deactivation successful');
      
      res.json({
        success: true,
        message: 'Account deactivated successfully',
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Account deactivation failed');
      
      next(error);
    }
  }

  async function assignManager(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    const userId = req.params.userId;
    const { managerId } = req.body;
    
    try {
      if (!userId || !managerId) {
        res.status(400).json({
          success: false,
          message: 'User ID and Manager ID are required',
          correlationId,
        });
        return;
      }
      
      logger.info({ correlationId, userId, managerId }, 'Processing manager assignment');
      
      await authService.assignManager(userId, managerId);
      
      logger.info({ correlationId, userId, managerId }, 'Manager assignment successful');
      
      res.json({
        success: true,
        message: 'Manager assigned successfully',
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        userId,
        managerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Manager assignment failed');
      
      next(error);
    }
  }

  async function getUsersByManager(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    const managerId = req.params.managerId || (req as any).user?.userId;
    
    try {
      if (!managerId) {
        res.status(400).json({
          success: false,
          message: 'Manager ID is required',
          correlationId,
        });
        return;
      }
      
      logger.debug({ correlationId, managerId }, 'Fetching users by manager');
      
      const users = await authService.getUsersByManager(managerId);
      
      res.json({
        success: true,
        message: 'Users retrieved successfully',
        data: { users, count: users.length },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        managerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Users retrieval failed');
      
      next(error);
    }
  }

  async function updateUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    const userId = req.params.userId;
    const { role } = req.body;
    
    try {
      if (!userId || !role) {
        res.status(400).json({
          success: false,
          message: 'User ID and role are required',
          correlationId,
        });
        return;
      }
      
      logger.info({ correlationId, userId, role }, 'Processing role update');
      
      await authService.updateUserRole(userId, role);
      
      logger.info({ correlationId, userId, role }, 'Role update successful');
      
      res.json({
        success: true,
        message: 'User role updated successfully',
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        userId,
        role,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Role update failed');
      
      next(error);
    }
  }

  // Return all handlers wrapped with async error handling
  return {
    registerUser: createAsyncErrorWrapper(registerUser),
    loginUser: createAsyncErrorWrapper(loginUser),
    refreshToken: createAsyncErrorWrapper(refreshToken),
    changePassword: createAsyncErrorWrapper(changePassword),
    updateProfile: createAsyncErrorWrapper(updateProfile),
    getUserProfile: createAsyncErrorWrapper(getUserProfile),
    deactivateAccount: createAsyncErrorWrapper(deactivateAccount),
    assignManager: createAsyncErrorWrapper(assignManager),
    getUsersByManager: createAsyncErrorWrapper(getUsersByManager),
    updateUserRole: createAsyncErrorWrapper(updateUserRole),
  };
}

export { createAuthHandlers }; 