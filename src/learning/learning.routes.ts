import { Router } from 'express';
import multer from 'multer';
import type { LearningHandlers } from './learning.handlers.js';
import { validateBody, validateParams, validateQuery } from '../shared/middleware/validation.middleware.js';
import {
  moduleIdParamsSchema,
  submitAssessmentSchema,
  submitEvaluationSchema,
  updateProgressSchema,
  paginationQuerySchema,
  userProgressQuerySchema,
} from './learning.schemas.js';

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only PDF and DOCX files
    if (file.mimetype === 'application/pdf' || 
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  },
});

export function createLearningRoutes(learningHandlers: LearningHandlers): Router {
  const router = Router();

  // Module management routes
  router.post(
    '/modules',
    upload.single('file'),
    learningHandlers.createModuleFromFile
  );

  router.get(
    '/modules',
    validateQuery(paginationQuerySchema),
    learningHandlers.getModules
  );

  router.get(
    '/modules/:moduleId',
    validateParams(moduleIdParamsSchema),
    learningHandlers.getModule
  );

  router.delete(
    '/modules/:moduleId',
    validateParams(moduleIdParamsSchema),
    learningHandlers.deleteModule
  );

  // User progress routes
  router.post(
    '/modules/:moduleId/start',
    validateParams(moduleIdParamsSchema),
    learningHandlers.startModule
  );

  router.put(
    '/progress',
    validateBody(updateProgressSchema),
    learningHandlers.updateProgress
  );

  router.get(
    '/modules/:moduleId/progress',
    validateParams(moduleIdParamsSchema),
    learningHandlers.getUserProgress
  );

  router.get(
    '/progress',
    validateQuery(userProgressQuerySchema),
    learningHandlers.getUserProgressList
  );

  // Assessment and evaluation routes
  router.post(
    '/assessments',
    validateBody(submitAssessmentSchema),
    learningHandlers.submitAssessment
  );

  router.post(
    '/evaluations',
    validateBody(submitEvaluationSchema),
    learningHandlers.submitEvaluation
  );

  // Analytics routes
  router.get(
    '/modules/:moduleId/stats',
    validateParams(moduleIdParamsSchema),
    learningHandlers.getModuleStats
  );

  router.get(
    '/stats',
    learningHandlers.getUserStats
  );

  return router;
} 