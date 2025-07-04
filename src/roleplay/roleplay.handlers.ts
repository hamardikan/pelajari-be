import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import type { RoleplayService } from './roleplay.services.js';
import type { RequestWithCorrelation } from '../config/logger.js';
import { createAsyncErrorWrapper } from '../shared/middleware/error.middleware.js';

export type RoleplayHandlerDependencies = {
  roleplayService: RoleplayService;
  logger: Logger;
};

export type RoleplayHandlers = {
  // Scenario endpoints
  getScenarios: (req: Request, res: Response, next: NextFunction) => void;
  getScenarioDetails: (req: Request, res: Response, next: NextFunction) => void;
  
  // Session management endpoints
  startSession: (req: Request, res: Response, next: NextFunction) => void;
  sendMessage: (req: Request, res: Response, next: NextFunction) => void;
  endSession: (req: Request, res: Response, next: NextFunction) => void;
  
  // Session retrieval endpoints
  getSessionDetails: (req: Request, res: Response, next: NextFunction) => void;
  getUserSessions: (req: Request, res: Response, next: NextFunction) => void;
  getSessionTranscript: (req: Request, res: Response, next: NextFunction) => void;
  // Fetch active session if any
  getActiveSession: (req: Request, res: Response, next: NextFunction) => void;
  
  // Analytics endpoints
  getScenarioStats: (req: Request, res: Response, next: NextFunction) => void;
  getUserStats: (req: Request, res: Response, next: NextFunction) => void;
};

function createRoleplayHandlers(dependencies: RoleplayHandlerDependencies): RoleplayHandlers {
  const { roleplayService, logger } = dependencies;

  async function getScenarios(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const options = (req as any).validatedQuery || req.query; // Use validated query data

      logger.debug({ correlationId, options }, 'Fetching available roleplay scenarios');
      
      const result = await roleplayService.getAvailableScenarios(options);
      
      logger.info({ 
        correlationId, 
        scenariosCount: result.scenarios.length,
        total: result.total 
      }, 'Roleplay scenarios retrieved successfully');
      
      res.json({
        success: true,
        message: 'Roleplay scenarios retrieved successfully',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to retrieve roleplay scenarios');
      next(error);
    }
  }

  async function getScenarioDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const { scenarioId } = req.params;
      
      if (!scenarioId) {
        throw new Error('Scenario ID is required');
      }

      logger.debug({ correlationId, scenarioId }, 'Fetching roleplay scenario details');
      
      const scenario = await roleplayService.getScenarioDetails(scenarioId);
      
      logger.info({ correlationId, scenarioId }, 'Roleplay scenario details retrieved successfully');
      
      res.json({
        success: true,
        message: 'Scenario details retrieved successfully',
        data: { scenario },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        scenarioId: req.params.scenarioId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to retrieve scenario details');
      next(error);
    }
  }

  async function startSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const userId = (req as any).user.userId;
      const { scenarioId } = req.params;
      
      if (!scenarioId) {
        throw new Error('Scenario ID is required');
      }

      logger.info({ correlationId, userId, scenarioId }, 'Starting roleplay session');
      
      const result = await roleplayService.startRoleplaySession(userId, scenarioId);
      
      logger.info({ 
        correlationId, 
        userId, 
        sessionId: result.sessionId,
        scenarioId 
      }, 'Roleplay session started successfully');
      
      res.status(201).json({
        success: true,
        message: 'Roleplay session started successfully',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        scenarioId: req.params.scenarioId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to start roleplay session');
      next(error);
    }
  }

  async function sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const userId = (req as any).user.userId;
      const { sessionId } = req.params;
      const { message } = req.body; // Should be validated by middleware
      
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      logger.info({ correlationId, userId, sessionId }, 'Processing roleplay message');
      
      const result = await roleplayService.sendMessage(sessionId, userId, message);
      
      logger.info({ 
        correlationId, 
        userId, 
        sessionId,
        messageId: result.messageId 
      }, 'Roleplay message processed successfully');
      
      res.json({
        success: true,
        message: 'Message sent successfully',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to process roleplay message');
      next(error);
    }
  }

  async function endSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const userId = (req as any).user.userId;
      const { sessionId } = req.params;
      
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      logger.info({ correlationId, userId, sessionId }, 'Ending roleplay session');
      
      const result = await roleplayService.endSession(sessionId, userId);
      
      logger.info({ 
        correlationId, 
        userId, 
        sessionId,
        overallScore: result.evaluation.overallScore 
      }, 'Roleplay session ended successfully');
      
      res.json({
        success: true,
        message: 'Session ended successfully',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to end roleplay session');
      next(error);
    }
  }

  async function getSessionDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const userId = (req as any).user.userId;
      const { sessionId } = req.params;
      
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      logger.debug({ correlationId, userId, sessionId }, 'Fetching roleplay session details');
      
      const session = await roleplayService.getSessionDetails(sessionId, userId);
      
      logger.info({ correlationId, userId, sessionId }, 'Session details retrieved successfully');
      
      res.json({
        success: true,
        message: 'Session details retrieved successfully',
        data: { session },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to retrieve session details');
      next(error);
    }
  }

  async function getUserSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const userId = (req as any).user.userId;
      const options = (req as any).validatedQuery || req.query; // Use validated query data

      logger.debug({ correlationId, userId, options }, 'Fetching user roleplay sessions');
      
      const result = await roleplayService.getUserSessionHistory(userId, options);
      
      logger.info({ 
        correlationId, 
        userId,
        sessionsCount: result.sessions.length,
        total: result.total 
      }, 'User sessions retrieved successfully');
      
      res.json({
        success: true,
        message: 'User sessions retrieved successfully',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to retrieve user sessions');
      next(error);
    }
  }

  async function getSessionTranscript(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const userId = (req as any).user.userId;
      const { sessionId } = req.params;
      
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      logger.debug({ correlationId, userId, sessionId }, 'Fetching roleplay session transcript');
      
      const result = await roleplayService.getSessionTranscript(sessionId, userId);
      
      logger.info({ 
        correlationId, 
        userId, 
        sessionId,
        messageCount: result.messages.length 
      }, 'Session transcript retrieved successfully');
      
      res.json({
        success: true,
        message: 'Session transcript retrieved successfully',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to retrieve session transcript');
      next(error);
    }
  }

  async function getActiveSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;

    try {
      const userId = (req as any).user.userId;

      logger.debug({ correlationId, userId }, 'Fetching active roleplay session');

      const session = await roleplayService.getActiveSession(userId);

      res.json({
        success: true,
        message: 'Active session retrieved successfully',
        data: { session },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to retrieve active session');
      next(error);
    }
  }

  async function getScenarioStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const { scenarioId } = req.params;
      
      if (!scenarioId) {
        throw new Error('Scenario ID is required');
      }

      logger.debug({ correlationId, scenarioId }, 'Fetching scenario statistics');
      
      const stats = await roleplayService.getScenarioStats(scenarioId);
      
      logger.info({ correlationId, scenarioId }, 'Scenario statistics retrieved successfully');
      
      res.json({
        success: true,
        message: 'Scenario statistics retrieved successfully',
        data: { stats },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        scenarioId: req.params.scenarioId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to retrieve scenario statistics');
      next(error);
    }
  }

  async function getUserStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const userId = (req as any).user.userId;

      logger.debug({ correlationId, userId }, 'Fetching user roleplay statistics');
      
      const stats = await roleplayService.getUserRoleplayStats(userId);
      
      logger.info({ correlationId, userId }, 'User roleplay statistics retrieved successfully');
      
      res.json({
        success: true,
        message: 'User statistics retrieved successfully',
        data: { stats },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to retrieve user statistics');
      next(error);
    }
  }

  // Return all handlers wrapped with async error handling
  return {
    getScenarios: createAsyncErrorWrapper(getScenarios),
    getScenarioDetails: createAsyncErrorWrapper(getScenarioDetails),
    startSession: createAsyncErrorWrapper(startSession),
    sendMessage: createAsyncErrorWrapper(sendMessage),
    endSession: createAsyncErrorWrapper(endSession),
    getSessionDetails: createAsyncErrorWrapper(getSessionDetails),
    getUserSessions: createAsyncErrorWrapper(getUserSessions),
    getSessionTranscript: createAsyncErrorWrapper(getSessionTranscript),
    getActiveSession: createAsyncErrorWrapper(getActiveSession),
    getScenarioStats: createAsyncErrorWrapper(getScenarioStats),
    getUserStats: createAsyncErrorWrapper(getUserStats),
  };
}

export { createRoleplayHandlers }; 