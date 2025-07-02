import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { getEnvironmentConfig } from './config/environment.js';
import { createDatabaseConnection } from './config/database.js';
import { createLogger, createRequestLogger, addCorrelationId } from './config/logger.js';
import { performStartupValidation } from './config/startup.js';
import { createAuthRepository } from './auth/auth.repositories.js';
import { createAuthService } from './auth/auth.services.js';
import { createAuthHandlers } from './auth/auth.handlers.js';
import { createJwtUtils } from './shared/utils/jwt.js';
import { createPasswordUtils } from './shared/utils/password.js';
import { createLearningRepository } from './learning/learning.repositories.js';
import { createLearningService } from './learning/learning.services.js';
import { createLearningHandlers } from './learning/learning.handlers.js';
import { createLearningRoutes } from './learning/learning.routes.js';
import { createIDPRepository } from './idp/idp.repositories.js';
import { createIDPService } from './idp/idp.services.js';
import { createIDPHandlers } from './idp/idp.handlers.js';
import { createIDPRoutes } from './idp/idp.routes.js';
import { createR2Client } from './shared/utils/r2.js';
import { createOpenRouterClient } from './shared/utils/openrouter.js';
import { createErrorHandler, createNotFoundHandler } from './shared/middleware/error.middleware.js';
import { validateBody, validateParams } from './shared/middleware/validation.middleware.js';
import { 
  registerSchema, 
  loginSchema, 
  refreshTokenSchema,
  changePasswordSchema,
  updateProfileSchema,
  deactivateAccountSchema,
  assignManagerSchema,
  updateUserRoleSchema,
  userIdParamsSchema
} from './auth/auth.schemas.js';

export async function createApp() {
  const config = getEnvironmentConfig();
  const logger = createLogger(config);
  
  logger.info('🚀 Starting application initialization...');
  
  // Initialize database connection
  const db = createDatabaseConnection(config);
  
  // CRITICAL: Validate all dependencies before proceeding
  logger.info('🔍 Performing startup dependency validation...');
  const validationResult = await performStartupValidation(db, config, logger);
  
  if (!validationResult.success) {
    logger.fatal({
      criticalFailures: validationResult.criticalFailures,
      results: validationResult.results
    }, '❌ STARTUP FAILED: Critical dependencies are not available');
    
    // Exit process immediately - don't start server with broken dependencies
    process.exit(1);
  }
  
  logger.info('✅ All critical dependencies validated successfully');
  
  // Create utilities (only after validation passes)
  const jwtUtils = createJwtUtils(config);
  const passwordUtils = createPasswordUtils();
  const r2Client = createR2Client({
    accessKeyId: config.R2_ACCESS_KEY_ID,
    secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    bucketName: config.R2_BUCKET_NAME,
    accountId: config.R2_ACCOUNT_ID,
  }, logger);
  const openRouterClient = createOpenRouterClient({
    apiKey: config.OPENROUTER_API_KEY,
    siteUrl: config.SITE_URL,
    siteName: config.SITE_NAME,
  }, logger);
  
  // Create repositories
  const authRepository = createAuthRepository(db, logger);
  const learningRepository = createLearningRepository(db, logger);
  const idpRepository = createIDPRepository(db, logger);
  
  // Create services
  const authService = createAuthService({
    authRepository,
    logger,
    jwtUtils,
    passwordUtils,
  });
  const learningService = createLearningService(
    learningRepository,
    r2Client,
    openRouterClient,
    logger
  );
  const idpService = createIDPService(idpRepository, logger);
  
  // Create handlers
  const authHandlers = createAuthHandlers({
    authService,
    logger,
  });
  const learningHandlers = createLearningHandlers({
    learningService,
    logger,
  });
  const idpHandlers = createIDPHandlers({
    idpService,
    logger,
  });
  
  // Create Express app
  const app = express();
  
  // Global middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(addCorrelationId());
  app.use(createRequestLogger(logger));
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      message: 'Service is healthy',
      timestamp: new Date().toISOString(),
    });
  });
  
  // Authentication routes
  app.post('/auth/register', validateBody(registerSchema), authHandlers.registerUser);
  app.post('/auth/login', validateBody(loginSchema), authHandlers.loginUser);
  app.post('/auth/refresh', validateBody(refreshTokenSchema), authHandlers.refreshToken);
  
  // Protected user routes (these would normally require authentication middleware)
  app.put('/auth/users/:userId/password', 
    validateParams(userIdParamsSchema), 
    validateBody(changePasswordSchema), 
    authHandlers.changePassword
  );
  
  app.put('/auth/users/:userId/profile', 
    validateParams(userIdParamsSchema), 
    validateBody(updateProfileSchema), 
    authHandlers.updateProfile
  );
  
  app.get('/auth/users/:userId/profile', 
    validateParams(userIdParamsSchema), 
    authHandlers.getUserProfile
  );
  
  app.delete('/auth/users/:userId', 
    validateParams(userIdParamsSchema), 
    validateBody(deactivateAccountSchema), 
    authHandlers.deactivateAccount
  );
  
  // Manager routes
  app.put('/auth/users/:userId/manager', 
    validateParams(userIdParamsSchema), 
    validateBody(assignManagerSchema), 
    authHandlers.assignManager
  );
  
  app.get('/auth/managers/:managerId/users', 
    validateParams(userIdParamsSchema), 
    authHandlers.getUsersByManager
  );
  
  app.put('/auth/users/:userId/role', 
    validateParams(userIdParamsSchema), 
    validateBody(updateUserRoleSchema), 
    authHandlers.updateUserRole
  );
  
  // Learning routes
  app.use('/api/learning', createLearningRoutes(learningHandlers));
  
  // IDP routes
  app.use('/api/idp', createIDPRoutes(idpHandlers));
  
  // Error handling middleware (must be last)
  app.use(createNotFoundHandler());
  app.use(createErrorHandler(logger, config.NODE_ENV === 'development'));
  
  logger.info('🎯 Application successfully assembled with all dependencies');
  
  return {
    app,
    config,
    logger,
    db,
    services: {
      authService,
      learningService,
      idpService,
    },
    handlers: {
      authHandlers,
      learningHandlers,
      idpHandlers,
    },
    healthStatus: validationResult,
  };
}

export async function startServer() {
  try {
    const { app, config, logger, healthStatus } = await createApp();
    
    logger.info('🌟 Starting HTTP server...');
    
    const server = app.listen(config.PORT, () => {
      logger.info({
        port: config.PORT,
        nodeEnv: config.NODE_ENV,
        dependenciesChecked: healthStatus.results.length,
        healthyDependencies: healthStatus.results.filter(r => r.status === 'healthy').length,
        version: process.env.npm_package_version || '1.0.0',
      }, '🚀 Server started successfully - All systems operational!');
      
      logger.info(`📡 Server is listening on http://localhost:${config.PORT}`);
      logger.info(`🏥 Health check available at http://localhost:${config.PORT}/health`);
    });
    
    // Graceful shutdown
    const shutdown = (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal');
      server.close(() => {
        logger.info('Server closed gracefully');
        process.exit(0);
      });
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    return server;
  } catch (error) {
    // This should never reach here due to process.exit(1) in createApp,
    // but just in case there are other startup errors
    console.error('❌ Failed to start server:', error);
    throw error;
  }
} 