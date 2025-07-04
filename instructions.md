Here’s a breakdown of the issues and how to fix them:

Problem 1: Database Connection is Not Closed
Your src/config/database.ts file defines a gracefulDatabaseShutdown function, but it's never called when the application shuts down. The shutdown function in src/app.ts only closes the HTTP server.

Problem 2: Worker Threads Are Not Terminated
Your services create worker threads for tasks like processing learning modules and roleplay sessions. However, the main application doesn't keep track of these workers or signal them to terminate during a shutdown. This can leave orphaned processes running and prevent a clean exit.

How to Fix the Graceful Shutdown
To implement a proper graceful shutdown, you need to modify your application to close the database connection and terminate all active worker threads within the server.close() callback.

Step 1: Modify app.ts to Handle Shutdown Logic
You'll need to update src/app.ts to track worker threads and include the cleanup logic in the shutdown sequence.

Here is the updated code for src/app.ts:

TypeScript

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { getEnvironmentConfig } from './config/environment.js';
import { createDatabaseConnection, gracefulDatabaseShutdown } from './config/database.js'; // Import gracefulDatabaseShutdown
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
import type { Worker } from 'worker_threads'; // Import Worker type

export async function createApp() {
  const config = getEnvironmentConfig();
  const logger = createLogger(config);
  
  logger.info('🚀 Starting application initialization...');
  
  // Initialize database connection
  const db = createDatabaseConnection(config);
  const dbConnection = db.client; // Get the underlying postgres client
  
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

  // A set to keep track of active workers
  const activeWorkers = new Set<Worker>();
  
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
    documentService,
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
    dbConnection, // Expose the connection for shutdown
    activeWorkers, // Expose the set of active workers
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
    const { server, config, logger, healthStatus, dbConnection, activeWorkers } = await createApp();
    
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
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal. Starting graceful shutdown...');

      // 1. Stop accepting new connections
      server.close(async () => {
        logger.info('Server closed. No longer accepting new connections.');

        // 2. Terminate all active worker threads
        logger.info(`Terminating ${activeWorkers.size} active worker threads...`);
        const workerPromises = Array.from(activeWorkers).map(worker => worker.terminate());
        await Promise.all(workerPromises);
        logger.info('All worker threads terminated.');

        // 3. Close the database connection
        await gracefulDatabaseShutdown(dbConnection);
        
        logger.info('Graceful shutdown completed. Exiting.');
        process.exit(0);
      });

      // Force shutdown after a timeout
      setTimeout(() => {
        logger.error('Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
      }, 10000); // 10-second timeout
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    throw error;
  }
}
Step 2: Update Services to Track Workers
Now, update your service files that create workers to add them to the activeWorkers set and remove them when they are finished. You'll need to pass the activeWorkers set from app.ts down to your services. This example shows how to modify src/learning/learning.services.ts. You should apply a similar pattern to idp.services.ts and roleplay.services.ts.

Here is the updated code for src/learning/learning.services.ts:

TypeScript

// ... other imports
import type { Worker } from 'worker_threads';

// ... other type definitions

export function createLearningService(
  learningRepository: LearningRepository,
  documentService: DocumentService,
  r2Client: R2Client,
  openRouterClient: OpenRouterClient,
  logger: Logger,
  activeWorkers: Set<Worker> // Add activeWorkers to the function signature
): LearningService {
  
  async function createModuleFromFile(userId: string, file: FileUploadData): Promise<ModuleCreationResult> {
    try {
      // ... (existing code for document upload)

      const worker = new Worker(workerPath, {
        workerData: {
          // ...
        },
      });

      // Add the new worker to the active set
      activeWorkers.add(worker);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          worker.terminate();
          // Remove from set on termination
          activeWorkers.delete(worker);
          reject(new Error('AI processing timeout after 5 minutes'));
        }, 5 * 60 * 1000);

        worker.on('message', async (message) => {
          clearTimeout(timeout);
          // Remove from set when done
          activeWorkers.delete(worker);
          // ... (rest of the message handling)
        });

        worker.on('error', (error) => {
          clearTimeout(timeout);
          // Remove from set on error
          activeWorkers.delete(worker);
          // ... (rest of the error handling)
        });

        worker.on('exit', (code) => {
          clearTimeout(timeout);
          // Remove from set on exit
          activeWorkers.delete(worker);
          if (code !== 0) {
            // ... (rest of the exit handling)
          }
        });
      });
    } catch (error) {
      // ... (error handling)
    }
  }

  // ... (rest of the service functions)

  return {
    // ...
  };
}
By making these changes, your application will now correctly handle shutdown signals, ensuring that all database connections are closed and worker threads are terminated before the process exits.