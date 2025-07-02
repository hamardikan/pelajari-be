import { Router } from 'express';
import type { RoleplayHandlers } from './roleplay.handlers.js';
import { validateBody, validateParams, validateQuery } from '../shared/middleware/validation.middleware.js';
import {
  scenarioIdParamsSchema,
  sessionIdParamsSchema,
  sendMessageSchema,
  scenariosQuerySchema,
  userSessionsQuerySchema,
} from './roleplay.schemas.js';

export function createRoleplayRoutes(roleplayHandlers: RoleplayHandlers): Router {
  const router = Router();

  // Scenario endpoints
  router.get(
    '/scenarios',
    validateQuery(scenariosQuerySchema),
    roleplayHandlers.getScenarios
  );

  router.get(
    '/scenarios/:scenarioId',
    validateParams(scenarioIdParamsSchema),
    roleplayHandlers.getScenarioDetails
  );

  router.get(
    '/scenarios/:scenarioId/stats',
    validateParams(scenarioIdParamsSchema),
    roleplayHandlers.getScenarioStats
  );

  // Session management endpoints
  router.post(
    '/scenarios/:scenarioId/start',
    validateParams(scenarioIdParamsSchema),
    roleplayHandlers.startSession
  );

  router.post(
    '/sessions/:sessionId/message',
    validateParams(sessionIdParamsSchema),
    validateBody(sendMessageSchema),
    roleplayHandlers.sendMessage
  );

  router.post(
    '/sessions/:sessionId/end',
    validateParams(sessionIdParamsSchema),
    roleplayHandlers.endSession
  );

  // Session retrieval endpoints
  router.get(
    '/sessions/:sessionId',
    validateParams(sessionIdParamsSchema),
    roleplayHandlers.getSessionDetails
  );

  router.get(
    '/sessions/:sessionId/transcript',
    validateParams(sessionIdParamsSchema),
    roleplayHandlers.getSessionTranscript
  );

  router.get(
    '/sessions',
    validateQuery(userSessionsQuerySchema),
    roleplayHandlers.getUserSessions
  );

  // Analytics endpoints
  router.get(
    '/stats',
    roleplayHandlers.getUserStats
  );

  return router;
} 