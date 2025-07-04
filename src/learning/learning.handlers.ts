import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import type { LearningService, FileUploadData } from './learning.services.js';
import type { RequestWithCorrelation } from '../config/logger.js';
import { createAsyncErrorWrapper } from '../shared/middleware/error.middleware.js';

export type LearningHandlerDependencies = {
  learningService: LearningService;
  logger: Logger;
};

export type LearningHandlers = {
  // Module management
  createModuleFromFile: (req: Request, res: Response, next: NextFunction) => void;
  getModule: (req: Request, res: Response, next: NextFunction) => void;
  getModules: (req: Request, res: Response, next: NextFunction) => void;
  deleteModule: (req: Request, res: Response, next: NextFunction) => void;
  
  // User progress
  startModule: (req: Request, res: Response, next: NextFunction) => void;
  updateProgress: (req: Request, res: Response, next: NextFunction) => void;
  getUserProgress: (req: Request, res: Response, next: NextFunction) => void;
  getUserProgressList: (req: Request, res: Response, next: NextFunction) => void;
  getOngoingModules: (req: Request, res: Response, next: NextFunction) => void;
  
  // Assessment and evaluation
  submitAssessment: (req: Request, res: Response, next: NextFunction) => void;
  submitEvaluation: (req: Request, res: Response, next: NextFunction) => void;
  
  // Analytics
  getModuleStats: (req: Request, res: Response, next: NextFunction) => void;
  getUserStats: (req: Request, res: Response, next: NextFunction) => void;
};

function createLearningHandlers(dependencies: LearningHandlerDependencies): LearningHandlers {
  const { learningService, logger } = dependencies;

  async function createModuleFromFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const userId = (req as any).user.userId;
      
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded',
          correlationId,
        });
        return;
      }

      const fileData: FileUploadData = {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      };

      logger.info({ 
        correlationId, 
        userId, 
        fileName: fileData.originalname,
        fileSize: fileData.size 
      }, 'Processing module creation from file');
      
      const result = await learningService.createModuleFromFile(userId, fileData);
      
      logger.info({ 
        correlationId, 
        userId, 
        moduleId: result.moduleId,
        status: result.status 
      }, 'Module creation initiated');
      
      res.status(201).json({
        success: true,
        message: 'Module creation initiated',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        fileName: req.file?.originalname,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Module creation failed');
      
      next(error);
    }
  }

  async function getModule(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const { moduleId } = req.params;
      
      if (!moduleId) {
        res.status(400).json({
          success: false,
          message: 'Module ID is required',
          correlationId,
        });
        return;
      }
      
      logger.debug({ correlationId, moduleId }, 'Fetching learning module');
      
      const module = await learningService.getModule(moduleId);
      
      res.json({
        success: true,
        message: 'Module retrieved successfully',
        data: { module },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        moduleId: req.params.moduleId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Module retrieval failed');
      
      next(error);
    }
  }

  async function getModules(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      logger.debug({ correlationId, query: req.query }, 'Fetching learning modules');
      
      const result = await learningService.getModules(req.query as any);
      
      res.json({
        success: true,
        message: 'Modules retrieved successfully',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        query: req.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Modules retrieval failed');
      
      next(error);
    }
  }

  async function deleteModule(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const { moduleId } = req.params;
      
      if (!moduleId) {
        res.status(400).json({
          success: false,
          message: 'Module ID is required',
          correlationId,
        });
        return;
      }
      
      logger.info({ correlationId, moduleId }, 'Deleting learning module');
      
      await learningService.deleteModule(moduleId);
      
      logger.info({ correlationId, moduleId }, 'Module deleted successfully');
      
      res.json({
        success: true,
        message: 'Module deleted successfully',
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        moduleId: req.params.moduleId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Module deletion failed');
      
      next(error);
    }
  }

  async function startModule(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const userId = (req as any).user.userId;
      const { moduleId } = req.params;
      
      if (!moduleId) {
        res.status(400).json({
          success: false,
          message: 'Module ID is required',
          correlationId,
        });
        return;
      }
      
      logger.info({ correlationId, userId, moduleId }, 'Starting module for user');
      
      const progress = await learningService.startModule(userId, moduleId);
      
      logger.info({ correlationId, userId, moduleId, progressId: progress.id }, 'Module started successfully');
      
      res.status(201).json({
        success: true,
        message: 'Module started successfully',
        data: { progress },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        moduleId: req.params.moduleId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Module start failed');
      
      next(error);
    }
  }

  async function updateProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const userId = (req as any).user.userId;
      
      logger.info({ correlationId, userId, updateData: req.body }, 'Updating user progress');
      
      const progress = await learningService.updateProgress(userId, req.body);
      
      logger.info({ 
        correlationId, 
        userId, 
        moduleId: req.body.moduleId,
        progressId: progress.id 
      }, 'Progress updated successfully');
      
      res.json({
        success: true,
        message: 'Progress updated successfully',
        data: { progress },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        updateData: req.body,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Progress update failed');
      
      next(error);
    }
  }

  async function getUserProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const userId = (req as any).user.userId;
      const { moduleId } = req.params;
      
      if (!moduleId) {
        res.status(400).json({
          success: false,
          message: 'Module ID is required',
          correlationId,
        });
        return;
      }
      
      logger.debug({ correlationId, userId, moduleId }, 'Fetching user progress');
      
      const progress = await learningService.getUserProgress(userId, moduleId);
      
      res.json({
        success: true,
        message: 'Progress retrieved successfully',
        data: { progress },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        moduleId: req.params.moduleId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Progress retrieval failed');
      
      next(error);
    }
  }

  async function getUserProgressList(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const userId = (req as any).user.userId;
      
      logger.debug({ correlationId, userId, query: req.query }, 'Fetching user progress list');
      
      const progressList = await learningService.getUserProgressList(userId, req.query as any);
      
      res.json({
        success: true,
        message: 'Progress list retrieved successfully',
        data: { 
          progressList, 
          count: progressList.length 
        },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        query: req.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Progress list retrieval failed');
      
      next(error);
    }
  }

  async function getOngoingModules(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;

    try {
      const userId = (req as any).user.userId;

      logger.debug({ correlationId, userId }, 'Fetching ongoing modules');

      const progressList = await learningService.getOngoingModules(userId);

      res.json({
        success: true,
        message: 'Ongoing modules retrieved successfully',
        data: { progressList, count: progressList.length },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Ongoing modules retrieval failed');
      next(error);
    }
  }

  async function submitAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const userId = (req as any).user.userId;
      
      logger.info({ 
        correlationId, 
        userId, 
        moduleId: req.body.moduleId,
        answersCount: req.body.answers?.length 
      }, 'Processing assessment submission');
      
      const result = await learningService.submitAssessment(userId, req.body);
      
      logger.info({ 
        correlationId, 
        userId, 
        moduleId: req.body.moduleId,
        score: result.score,
        percentage: result.percentage 
      }, 'Assessment submitted successfully');
      
      res.json({
        success: true,
        message: 'Assessment submitted successfully',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        submitData: req.body,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Assessment submission failed');
      
      next(error);
    }
  }

  async function submitEvaluation(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const userId = (req as any).user.userId;
      
      logger.info({ 
        correlationId, 
        userId, 
        moduleId: req.body.moduleId,
        questionIndex: req.body.questionIndex 
      }, 'Processing evaluation submission');
      
      const result = await learningService.submitEvaluation(userId, req.body);
      
      logger.info({ 
        correlationId, 
        userId, 
        moduleId: req.body.moduleId,
        questionIndex: req.body.questionIndex,
        score: result.score 
      }, 'Evaluation submitted successfully');
      
      res.json({
        success: true,
        message: 'Evaluation submitted successfully',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        submitData: req.body,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Evaluation submission failed');
      
      next(error);
    }
  }

  async function getModuleStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const { moduleId } = req.params;
      
      if (!moduleId) {
        res.status(400).json({
          success: false,
          message: 'Module ID is required',
          correlationId,
        });
        return;
      }
      
      logger.debug({ correlationId, moduleId }, 'Fetching module statistics');
      
      const stats = await learningService.getModuleStats(moduleId);
      
      res.json({
        success: true,
        message: 'Module statistics retrieved successfully',
        data: { stats },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        moduleId: req.params.moduleId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Module statistics retrieval failed');
      
      next(error);
    }
  }

  async function getUserStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const userId = (req as any).user.userId;
      
      logger.debug({ correlationId, userId }, 'Fetching user statistics');
      
      const stats = await learningService.getUserStats(userId);
      
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
      }, 'User statistics retrieval failed');
      
      next(error);
    }
  }

  // Return all handlers wrapped with async error handling
  return {
    createModuleFromFile: createAsyncErrorWrapper(createModuleFromFile),
    getModule: createAsyncErrorWrapper(getModule),
    getModules: createAsyncErrorWrapper(getModules),
    deleteModule: createAsyncErrorWrapper(deleteModule),
    startModule: createAsyncErrorWrapper(startModule),
    updateProgress: createAsyncErrorWrapper(updateProgress),
    getUserProgress: createAsyncErrorWrapper(getUserProgress),
    getUserProgressList: createAsyncErrorWrapper(getUserProgressList),
    getOngoingModules: createAsyncErrorWrapper(getOngoingModules),
    submitAssessment: createAsyncErrorWrapper(submitAssessment),
    submitEvaluation: createAsyncErrorWrapper(submitEvaluation),
    getModuleStats: createAsyncErrorWrapper(getModuleStats),
    getUserStats: createAsyncErrorWrapper(getUserStats),
  };
}

export { createLearningHandlers }; 