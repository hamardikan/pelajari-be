import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getEnvironmentConfig } from './config/environment.js';
import { createDatabaseConnection } from './config/database.js';
import { createLogger, createRequestLogger, addCorrelationId } from './config/logger.js';
import { performStartupValidation } from './config/startup.js';
import { createAuthRepository } from './auth/auth.repositories.js';
import { createAuthService } from './auth/auth.services.js';
import { createJwtUtils } from './shared/utils/jwt.js';
import { createPasswordUtils } from './shared/utils/password.js';
import { createErrorHandler, createNotFoundHandler } from './shared/middleware/error.middleware.js';
import { validateBody } from './shared/middleware/validation.middleware.js';
import { registerSchema, loginSchema } from './auth/auth.schemas.js';

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
  
  // Create repositories
  const authRepository = createAuthRepository(db, logger);
  
  // Create services
  const authService = createAuthService({
    authRepository,
    logger,
    jwtUtils,
    passwordUtils,
  });
  
  // Create Express app
  const app = express();
  
  // Global middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
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
  
  // Auth routes for testing
  app.post('/auth/register', validateBody(registerSchema), async (req, res, next) => {
    try {
      const user = await authService.registerUser(req.body);
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  });
  
  app.post('/auth/login', validateBody(loginSchema), async (req, res, next) => {
    try {
      const result = await authService.loginUser(req.body);
      res.json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });
  
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