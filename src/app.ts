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
import { createAuthRoutes } from './auth/auth.routes.js';
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
import { createDocumentRepository } from './documents/documents.repositories.js';
import { createDocumentService } from './documents/documents.services.js';
import { createDocumentHandlers } from './documents/documents.handlers.js';
import { createDocumentRoutes } from './documents/documents.routes.js';
import { createRoleplayRepository } from './roleplay/roleplay.repositories.js';
import { createRoleplayService } from './roleplay/roleplay.services.js';
import { createRoleplayHandlers } from './roleplay/roleplay.handlers.js';
import { createRoleplayRoutes } from './roleplay/roleplay.routes.js';
import { createR2Client } from './shared/utils/r2.js';
import { createOpenRouterClient } from './shared/utils/openrouter.js';
import { createErrorHandler, createNotFoundHandler } from './shared/middleware/error.middleware.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAuthMiddleware } from './shared/middleware/auth.middleware.js';

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
  const authMiddleware = createAuthMiddleware(jwtUtils);
  
  // Create repositories
  const authRepository = createAuthRepository(db, logger);
  const learningRepository = createLearningRepository(db, logger);
  const idpRepository = createIDPRepository(db, logger);
  const documentRepository = createDocumentRepository(db, logger);
  const roleplayRepository = createRoleplayRepository(db, logger);
  
  // Create services
  const authService = createAuthService({
    authRepository,
    logger,
    jwtUtils,
    passwordUtils,
  });
  const documentService = createDocumentService(documentRepository, r2Client, logger);
  const learningService = createLearningService(
    learningRepository,
    documentService, // NEW: Add document service
    r2Client,
    openRouterClient,
    logger
  );
  const idpService = createIDPService(idpRepository, logger);
  const roleplayService = createRoleplayService(roleplayRepository, logger);
  
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
  const documentHandlers = createDocumentHandlers({
    documentService,
    logger,
  });
  const roleplayHandlers = createRoleplayHandlers({
    roleplayService,
    logger,
  });
  
  // Create Express app
  const app = express();
  
  // Create HTTP server for Socket.IO
  const server = createServer(app);
  
  // Initialize Socket.IO
  const io = new Server(server, {
    cors: {
      origin: config.NODE_ENV === 'development' ? "http://localhost:3000" : config.SITE_URL,
      methods: ["GET", "POST"]
    }
  });
  
  // Socket.IO connection handling
  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'Client connected to Socket.IO');
    
    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id }, 'Client disconnected from Socket.IO');
    });
    
    // Add your Socket.IO event handlers here
    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      logger.info({ socketId: socket.id, roomId }, 'Client joined room');
    });
    
    socket.on('leave-room', (roomId) => {
      socket.leave(roomId);
      logger.info({ socketId: socket.id, roomId }, 'Client left room');
    });
  });
  
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
  app.use('/auth', createAuthRoutes(authHandlers));
  
  // Attach authentication middleware for all subsequent routes
  app.use(authMiddleware);
  
  // Document routes
  app.use('/api/documents', createDocumentRoutes(documentHandlers));

  // Learning routes
  app.use('/api/learning', createLearningRoutes(learningHandlers));
  
  // IDP routes
  app.use('/api/idp', createIDPRoutes(idpHandlers));
  
  // Roleplay routes
  app.use('/api/roleplay', createRoleplayRoutes(roleplayHandlers));
  
  // Error handling middleware (must be last)
  app.use(createNotFoundHandler());
  app.use(createErrorHandler(logger, config.NODE_ENV === 'development'));
  
  logger.info('🎯 Application successfully assembled with all dependencies');
  
  return {
    app,
    server,
    io,
    config,
    logger,
    db,
    services: {
      authService,
      learningService,
      idpService,
      documentService,
      roleplayService,
    },
    handlers: {
      authHandlers,
      learningHandlers,
      idpHandlers,
      documentHandlers,
      roleplayHandlers,
    },
    healthStatus: validationResult,
  };
}

export async function startServer() {
  try {
    const { server, config, logger, healthStatus } = await createApp();
    
    logger.info('🌟 Starting HTTP server...');
    
    server.listen(config.PORT, () => {
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