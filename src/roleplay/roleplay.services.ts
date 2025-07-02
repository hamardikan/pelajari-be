import type { Logger } from 'pino';
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import type { 
  RoleplayRepository, 
  RoleplayScenarioRecord, 
  RoleplaySessionRecord,
  ScenariosQuery,
  UserSessionsQuery 
} from './roleplay.repositories.js';
import type { RoleplaySessionData } from '../db/schema.js';
import { createBusinessLogicError, createNotFoundError } from '../shared/middleware/error.middleware.js';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to resolve worker path
function resolveWorkerPath(workerName: string): string {
  const possiblePaths = [
    path.join(__dirname, '..', 'workers', `${workerName}.worker.js`),
    path.join(process.cwd(), 'dist', 'workers', `${workerName}.worker.js`),
    path.join(__dirname, '..', 'workers', `${workerName}.worker.ts`),
    path.join(process.cwd(), 'src', 'workers', `${workerName}.worker.ts`),
  ];

  for (const workerPath of possiblePaths) {
    if (fs.existsSync(workerPath)) {
      return workerPath;
    }
  }

  return path.join(__dirname, '..', 'workers', `${workerName}.worker.js`);
}

export type SessionStartResult = {
  sessionId: string;
  initialMessage: string;
  status: 'active';
};

export type MessageResponse = {
  messageId: string;
  aiResponse: string;
  timestamp: string;
};

export type SessionEndResult = {
  sessionId: string;
  evaluation: {
    overallScore: number;
    competencyScores: Record<string, number>;
    strengths: string[];
    areasForImprovement: string[];
    detailedFeedback: string;
    recommendations: string[];
  };
  status: 'completed';
};

export type RoleplayService = {
  // Scenario management
  getAvailableScenarios: (options: ScenariosQuery) => Promise<{
    scenarios: RoleplayScenarioRecord[];
    total: number;
    page: number;
    limit: number;
  }>;
  getScenarioDetails: (scenarioId: string) => Promise<RoleplayScenarioRecord>;
  
  // Session management
  startRoleplaySession: (userId: string, scenarioId: string) => Promise<SessionStartResult>;
  sendMessage: (sessionId: string, userId: string, message: string) => Promise<MessageResponse>;
  endSession: (sessionId: string, userId: string) => Promise<SessionEndResult>;
  
  // Session retrieval
  getSessionDetails: (sessionId: string, userId: string) => Promise<RoleplaySessionRecord>;
  getUserSessionHistory: (userId: string, options: UserSessionsQuery) => Promise<{
    sessions: RoleplaySessionRecord[];
    total: number;
    page: number;
    limit: number;
  }>;
  getSessionTranscript: (sessionId: string, userId: string) => Promise<{
    messages: Array<{
      id: string;
      timestamp: string;
      sender: 'user' | 'ai';
      content: string;
    }>;
    scenario: {
      title: string;
      description: string;
    };
  }>;
  
  // Analytics
  getScenarioStats: (scenarioId: string) => Promise<{
    totalSessions: number;
    completedSessions: number;
    averageScore: number;
    averageDuration: number;
  }>;
  getUserRoleplayStats: (userId: string) => Promise<{
    totalSessions: number;
    completedSessions: number;
    averageScore: number;
    totalTimeSpent: number;
  }>;
};

export function createRoleplayService(
  roleplayRepository: RoleplayRepository,
  logger: Logger
): RoleplayService {

  async function getAvailableScenarios(options: ScenariosQuery) {
    try {
      logger.debug({ options }, 'Fetching available roleplay scenarios');
      
      const result = await roleplayRepository.getPublishedScenarios(options);
      
      logger.info({ 
        foundScenarios: result.scenarios.length,
        total: result.total 
      }, 'Available scenarios retrieved successfully');
      
      return result;
    } catch (error) {
      logger.error({ error, options }, 'Error fetching available scenarios');
      throw error;
    }
  }

  async function getScenarioDetails(scenarioId: string): Promise<RoleplayScenarioRecord> {
    try {
      logger.debug({ scenarioId }, 'Fetching scenario details');
      
      const scenario = await roleplayRepository.getScenarioById(scenarioId);
      if (!scenario) {
        throw createNotFoundError(`Roleplay scenario not found with ID: ${scenarioId}`);
      }
      
      if (!scenario.data.isPublished) {
        throw createBusinessLogicError('This scenario is not currently available');
      }
      
      return scenario;
    } catch (error) {
      logger.error({ error, scenarioId }, 'Error fetching scenario details');
      throw error;
    }
  }

  async function startRoleplaySession(userId: string, scenarioId: string): Promise<SessionStartResult> {
    try {
      logger.info({ userId, scenarioId }, 'Starting roleplay session');

      // Check if user already has an active session
      const activeSession = await roleplayRepository.getActiveUserSession(userId);
      if (activeSession) {
        throw createBusinessLogicError('You already have an active roleplay session. Please complete or abandon it before starting a new one.');
      }

      // Get scenario details
      const scenario = await getScenarioDetails(scenarioId);

      // Create session data
      const sessionData: RoleplaySessionData = {
        userId,
        scenarioId,
        sessionData: {
          startedAt: new Date().toISOString(),
          status: 'active',
          messages: [],
        },
        context: {},
      };

      // Create session in database
      const newSession = await roleplayRepository.createSession(sessionData);

      // Increment scenario usage
      await roleplayRepository.incrementScenarioUsage(scenarioId);

      // Generate initial AI message using worker
      const workerPath = resolveWorkerPath('roleplay');
      const worker = new Worker(workerPath, {
        workerData: {
          type: 'initial-message',
          sessionId: newSession.id,
          scenario: scenario.data,
          userId,
        },
      });

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          worker.terminate();
          reject(new Error('Initial message generation timeout'));
        }, 30000); // 30 seconds timeout

        worker.on('message', async (message) => {
          clearTimeout(timeout);
          
          if (!message.success) {
            logger.error({ 
              userId, 
              scenarioId,
              error: message.error 
            }, 'Worker failed to generate initial message');
            
            reject(new Error(message.error));
          } else {
            try {
              // Add initial AI message to session
              const initialMessage = {
                id: randomUUID(),
                timestamp: new Date().toISOString(),
                sender: 'ai' as const,
                content: message.data.initialMessage,
              };

              await roleplayRepository.updateSession(newSession.id, {
                sessionData: {
                  ...newSession.data.sessionData,
                  messages: [initialMessage],
                },
              });

              logger.info({ 
                userId, 
                sessionId: newSession.id,
                scenarioId 
              }, 'Roleplay session started successfully');

              resolve({
                sessionId: newSession.id,
                initialMessage: message.data.initialMessage,
                status: 'active',
              });
            } catch (dbError) {
              logger.error({ 
                userId, 
                sessionId: newSession.id,
                error: dbError 
              }, 'Failed to save initial message');
              
              reject(dbError);
            }
          }
        });

        worker.on('error', (error) => {
          clearTimeout(timeout);
          logger.error({ 
            userId, 
            scenarioId,
            error: error.message 
          }, 'Worker error during initial message generation');
          
          reject(error);
        });

        worker.on('exit', (code) => {
          clearTimeout(timeout);
          if (code !== 0) {
            logger.error({ 
              userId, 
              scenarioId,
              exitCode: code 
            }, 'Initial message worker exited with error');
            
            reject(new Error(`Worker exited with code ${code}`));
          }
        });
      });
    } catch (error) {
      logger.error({ 
        error, 
        userId,
        scenarioId 
      }, 'Error starting roleplay session');
      throw error;
    }
  }

  async function sendMessage(sessionId: string, userId: string, message: string): Promise<MessageResponse> {
    try {
      logger.info({ sessionId, userId }, 'Processing user message in roleplay session');

      // Get and validate session
      const session = await roleplayRepository.getSessionById(sessionId);
      if (!session) {
        throw createNotFoundError(`Roleplay session not found with ID: ${sessionId}`);
      }

      if (session.data.userId !== userId) {
        throw createBusinessLogicError('You can only send messages to your own sessions');
      }

      if (session.data.sessionData.status !== 'active') {
        throw createBusinessLogicError('This session is no longer active');
      }

      // Get scenario for context
      const scenario = await roleplayRepository.getScenarioById(session.data.scenarioId);
      if (!scenario) {
        throw createNotFoundError('Associated scenario not found');
      }

      // Add user message to session
      const userMessage = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        sender: 'user' as const,
        content: message,
      };

      const updatedMessages = [...session.data.sessionData.messages, userMessage];

      // Generate AI response using worker
      const workerPath = resolveWorkerPath('roleplay');
      const worker = new Worker(workerPath, {
        workerData: {
          type: 'conversation',
          sessionId,
          scenario: scenario.data,
          conversationHistory: updatedMessages,
          userId,
        },
      });

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          worker.terminate();
          reject(new Error('AI response generation timeout'));
        }, 60000); // 60 seconds timeout

        worker.on('message', async (workerMessage) => {
          clearTimeout(timeout);
          
          if (!workerMessage.success) {
            logger.error({ 
              sessionId, 
              userId,
              error: workerMessage.error 
            }, 'Worker failed to generate AI response');
            
            reject(new Error(workerMessage.error));
          } else {
            try {
              // Add AI response to session
              const aiMessage = {
                id: randomUUID(),
                timestamp: new Date().toISOString(),
                sender: 'ai' as const,
                content: workerMessage.data.aiResponse,
              };

              const finalMessages = [...updatedMessages, aiMessage];

              await roleplayRepository.updateSession(sessionId, {
                sessionData: {
                  ...session.data.sessionData,
                  messages: finalMessages,
                },
              });

              logger.info({ 
                sessionId, 
                userId,
                messageCount: finalMessages.length 
              }, 'Message exchange completed successfully');

              resolve({
                messageId: aiMessage.id,
                aiResponse: workerMessage.data.aiResponse,
                timestamp: aiMessage.timestamp,
              });
            } catch (dbError) {
              logger.error({ 
                sessionId, 
                userId,
                error: dbError 
              }, 'Failed to save message exchange');
              
              reject(dbError);
            }
          }
        });

        worker.on('error', (error) => {
          clearTimeout(timeout);
          logger.error({ 
            sessionId, 
            userId,
            error: error.message 
          }, 'Worker error during AI response generation');
          
          reject(error);
        });

        worker.on('exit', (code) => {
          clearTimeout(timeout);
          if (code !== 0) {
            logger.error({ 
              sessionId, 
              userId,
              exitCode: code 
            }, 'AI response worker exited with error');
            
            reject(new Error(`Worker exited with code ${code}`));
          }
        });
      });
    } catch (error) {
      logger.error({ 
        error, 
        sessionId,
        userId 
      }, 'Error processing user message');
      throw error;
    }
  }

  async function endSession(sessionId: string, userId: string): Promise<SessionEndResult> {
    try {
      logger.info({ sessionId, userId }, 'Ending roleplay session');

      // Get and validate session
      const session = await roleplayRepository.getSessionById(sessionId);
      if (!session) {
        throw createNotFoundError(`Roleplay session not found with ID: ${sessionId}`);
      }

      if (session.data.userId !== userId) {
        throw createBusinessLogicError('You can only end your own sessions');
      }

      if (session.data.sessionData.status !== 'active') {
        throw createBusinessLogicError('This session is already ended');
      }

      // Get scenario for evaluation context
      const scenario = await roleplayRepository.getScenarioById(session.data.scenarioId);
      if (!scenario) {
        throw createNotFoundError('Associated scenario not found');
      }

      // Calculate session duration
      const startTime = new Date(session.data.sessionData.startedAt);
      const endTime = new Date();
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000); // minutes

      // Generate evaluation using worker
      const workerPath = resolveWorkerPath('roleplay');
      const worker = new Worker(workerPath, {
        workerData: {
          type: 'evaluation',
          sessionId,
          scenario: scenario.data,
          conversationHistory: session.data.sessionData.messages,
          duration,
          userId,
        },
      });

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          worker.terminate();
          reject(new Error('Session evaluation timeout'));
        }, 120000); // 2 minutes timeout

        worker.on('message', async (message) => {
          clearTimeout(timeout);
          
          if (!message.success) {
            logger.error({ 
              sessionId, 
              userId,
              error: message.error 
            }, 'Worker failed to generate session evaluation');
            
            reject(new Error(message.error));
          } else {
            try {
              const evaluation = message.data.evaluation;

              // Update session with evaluation and completion
              await roleplayRepository.updateSession(sessionId, {
                sessionData: {
                  ...session.data.sessionData,
                  endedAt: endTime.toISOString(),
                  status: 'completed',
                  totalDuration: duration,
                  evaluation,
                },
              });

              // Update scenario statistics
              await roleplayRepository.updateScenarioStats(session.data.scenarioId, evaluation.overallScore);

              logger.info({ 
                sessionId, 
                userId,
                overallScore: evaluation.overallScore,
                duration 
              }, 'Roleplay session ended successfully');

              resolve({
                sessionId,
                evaluation,
                status: 'completed',
              });
            } catch (dbError) {
              logger.error({ 
                sessionId, 
                userId,
                error: dbError 
              }, 'Failed to save session evaluation');
              
              reject(dbError);
            }
          }
        });

        worker.on('error', (error) => {
          clearTimeout(timeout);
          logger.error({ 
            sessionId, 
            userId,
            error: error.message 
          }, 'Worker error during session evaluation');
          
          reject(error);
        });

        worker.on('exit', (code) => {
          clearTimeout(timeout);
          if (code !== 0) {
            logger.error({ 
              sessionId, 
              userId,
              exitCode: code 
            }, 'Evaluation worker exited with error');
            
            reject(new Error(`Worker exited with code ${code}`));
          }
        });
      });
    } catch (error) {
      logger.error({ 
        error, 
        sessionId,
        userId 
      }, 'Error ending roleplay session');
      throw error;
    }
  }

  async function getSessionDetails(sessionId: string, userId: string): Promise<RoleplaySessionRecord> {
    try {
      logger.debug({ sessionId, userId }, 'Fetching session details');
      
      const session = await roleplayRepository.getSessionById(sessionId);
      if (!session) {
        throw createNotFoundError(`Roleplay session not found with ID: ${sessionId}`);
      }

      if (session.data.userId !== userId) {
        throw createBusinessLogicError('You can only view your own sessions');
      }
      
      return session;
    } catch (error) {
      logger.error({ error, sessionId, userId }, 'Error fetching session details');
      throw error;
    }
  }

  async function getUserSessionHistory(userId: string, options: UserSessionsQuery) {
    try {
      logger.debug({ userId, options }, 'Fetching user session history');
      
      const result = await roleplayRepository.getUserSessions(userId, options);
      
      logger.info({ 
        userId,
        foundSessions: result.sessions.length,
        total: result.total 
      }, 'User session history retrieved successfully');
      
      return result;
    } catch (error) {
      logger.error({ error, userId, options }, 'Error fetching user session history');
      throw error;
    }
  }

  async function getSessionTranscript(sessionId: string, userId: string) {
    try {
      logger.debug({ sessionId, userId }, 'Fetching session transcript');
      
      const session = await getSessionDetails(sessionId, userId);
      const scenario = await roleplayRepository.getScenarioById(session.data.scenarioId);
      
      if (!scenario) {
        throw createNotFoundError('Associated scenario not found');
      }

      return {
        messages: session.data.sessionData.messages,
        scenario: {
          title: scenario.data.title,
          description: scenario.data.description,
        },
      };
    } catch (error) {
      logger.error({ error, sessionId, userId }, 'Error fetching session transcript');
      throw error;
    }
  }

  async function getScenarioStats(scenarioId: string) {
    try {
      logger.debug({ scenarioId }, 'Fetching scenario statistics');
      return await roleplayRepository.getScenarioStats(scenarioId);
    } catch (error) {
      logger.error({ error, scenarioId }, 'Error fetching scenario statistics');
      throw error;
    }
  }

  async function getUserRoleplayStats(userId: string) {
    try {
      logger.debug({ userId }, 'Fetching user roleplay statistics');
      return await roleplayRepository.getUserRoleplayStats(userId);
    } catch (error) {
      logger.error({ error, userId }, 'Error fetching user roleplay statistics');
      throw error;
    }
  }

  return {
    // Scenario management
    getAvailableScenarios,
    getScenarioDetails,
    
    // Session management
    startRoleplaySession,
    sendMessage,
    endSession,
    
    // Session retrieval
    getSessionDetails,
    getUserSessionHistory,
    getSessionTranscript,
    
    // Analytics
    getScenarioStats,
    getUserRoleplayStats,
  };
} 