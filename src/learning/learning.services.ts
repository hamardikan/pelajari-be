import type { Logger } from 'pino';
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import type { LearningRepository, LearningModuleRecord, UserProgressRecord } from './learning.repositories.js';
import type { R2Client } from '../shared/utils/r2.js';
import type { OpenRouterClient, AssessmentQuestionData, EvaluationQuestionData } from '../shared/utils/openrouter.js';
import type { DocumentService } from '../documents/documents.services.js';
import type { LearningModuleData, UserModuleProgressData } from '../db/schema.js';
import type { 
  SubmitAssessmentData, 
  SubmitEvaluationData, 
  UpdateProgressData,
  PaginationQuery,
  UserProgressQuery 
} from './learning.schemas.js';
import { createBusinessLogicError, createNotFoundError } from '../shared/middleware/error.middleware.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type FileUploadData = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export type ModuleCreationResult = {
  moduleId: string;
  documentId?: string; // NEW: Return document ID too
  status: 'processing' | 'completed' | 'failed';
  message: string;
};

export type AssessmentResult = {
  score: number;
  totalQuestions: number;
  percentage: number;
  feedback: Array<{
    questionIndex: number;
    correct: boolean;
    explanation: string;
  }>;
};

export type EvaluationResult = {
  score: number;
  feedback: string;
  suggestions: string[];
};

export type LearningService = {
  // Module management
  createModuleFromFile: (userId: string, file: FileUploadData) => Promise<ModuleCreationResult>;
  getModule: (moduleId: string) => Promise<LearningModuleRecord>;
  getModules: (options: PaginationQuery) => Promise<{
    modules: LearningModuleRecord[];
    total: number;
    page: number;
    limit: number;
  }>;
  deleteModule: (moduleId: string) => Promise<void>;
  
  // User progress management
  startModule: (userId: string, moduleId: string) => Promise<UserProgressRecord>;
  updateProgress: (userId: string, data: UpdateProgressData) => Promise<UserProgressRecord>;
  getUserProgress: (userId: string, moduleId: string) => Promise<UserProgressRecord>;
  getUserProgressList: (userId: string, options: UserProgressQuery) => Promise<UserProgressRecord[]>;
  // Quick retrieval helpers
  getOngoingModules: (userId: string) => Promise<UserProgressRecord[]>;
  
  // Assessment and evaluation
  submitAssessment: (userId: string, data: SubmitAssessmentData) => Promise<AssessmentResult>;
  submitEvaluation: (userId: string, data: SubmitEvaluationData) => Promise<EvaluationResult>;
  
  // Analytics
  getModuleStats: (moduleId: string) => Promise<{
    totalUsers: number;
    completedUsers: number;
    averageProgress: number;
    averageTimeSpent: number;
  }>;
  getUserStats: (userId: string) => Promise<{
    totalModules: number;
    completedModules: number;
    inProgressModules: number;
    totalTimeSpent: number;
  }>;
};

// Helper to dynamically resolve worker file (supports TS in dev and JS in prod)
function resolveWorkerPath(workerName: string): string {
  const possiblePaths = [
    // Production / compiled JS (dist or compiled within src)
    path.join(__dirname, '..', 'workers', `${workerName}.worker.js`),
    path.join(process.cwd(), 'dist', 'workers', `${workerName}.worker.js`),
    // Development TypeScript sources (ts-node / tsx)
    path.join(__dirname, '..', 'workers', `${workerName}.worker.ts`),
    path.join(process.cwd(), 'src', 'workers', `${workerName}.worker.ts`),
  ];

  for (const p of possiblePaths) {
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (fs.existsSync(p)) {
        return p;
      }
    } catch {
      /* ignore */
    }
  }
  // Fallback to JS path inside workers dir
  return path.join(__dirname, '..', 'workers', `${workerName}.worker.js`);
}

export function createLearningService(
  learningRepository: LearningRepository,
  documentService: DocumentService,
  r2Client: R2Client,
  openRouterClient: OpenRouterClient,
  logger: Logger,
  activeWorkers: Set<Worker>
): LearningService {
  
  async function createModuleFromFile(userId: string, file: FileUploadData): Promise<ModuleCreationResult> {
    try {
      logger.info({ 
        userId, 
        fileName: file.originalname, 
        fileSize: file.size,
        mimeType: file.mimetype 
      }, 'Starting module creation from file');

      // STEP 1: Upload document first using document service
      logger.info({ userId, fileName: file.originalname }, 'Uploading document for module generation');
      const document = await documentService.uploadDocument(userId, file, {
        title: `Source: ${file.originalname}`,
        description: 'Document uploaded for learning module generation',
        tags: ['learning-source'],
      });

      // STEP 2: Process with AI using the document
      logger.info({ userId, fileName: file.originalname, documentId: document.id }, 'Starting AI processing of document');

      // Start worker for AI processing – tsx (in dev) or plain Node (in prod) will
      // transparently handle either a TypeScript or pre-compiled JavaScript file.
      const workerPath = resolveWorkerPath('learning');

      const worker = new Worker(workerPath, {
        workerData: {
          documentId: document.id,
          pdfBuffer: file.buffer,
          fileName: file.originalname,
          userId,
        },
      });

      // Track worker so it can be terminated during shutdown
      activeWorkers.add(worker);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          worker.terminate();
          reject(new Error('AI processing timeout after 5 minutes'));
        }, 5 * 60 * 1000); // 5 minutes timeout

        worker.on('message', async (message) => {
          clearTimeout(timeout);
          
          if (message.error) {
            logger.error({ 
              userId, 
              fileName: file.originalname,
              documentId: document.id,
              error: message.error 
            }, 'Worker failed to process file');
            
            reject(new Error(message.error));
          } else {
            try {
              // STEP 3: Create learning module with document reference
              const moduleData: LearningModuleData = {
                title: message.content.title,
                summary: message.content.summary,
                sourceDocumentId: document.id, // NEW: Reference to document
                authorId: userId,
                isPublished: true,
                difficulty: 'intermediate', // Default, can be enhanced later
                estimatedDuration: message.content.flashcards.length * 2 + message.content.assessment.length * 3, // rough estimate
                tags: [],
                prerequisites: [],
                content: {
                  sections: [{
                    title: 'Summary',
                    content: message.content.summary,
                    type: 'text',
                  }],
                  flashcards: message.content.flashcards,
                  assessment: message.content.assessment,
                  evaluation: message.content.evaluation,
                },
                flashcards: message.content.flashcards,
                assessment: message.content.assessment,
                evaluation: message.content.evaluation,
              };

              const newModule = await learningRepository.createModule(moduleData);
              
              // STEP 4: Update document usage tracking
              await documentService.markDocumentUsed(document.id, 'learning_module', newModule.id);
              
              logger.info({ 
                userId, 
                moduleId: newModule.id,
                documentId: document.id,
                fileName: file.originalname 
              }, 'Module created successfully from file');

              resolve({
                moduleId: newModule.id,
                documentId: document.id, // NEW: Return document ID too
                status: 'completed',
                message: 'Module created successfully'
              });
            } catch (dbError) {
              logger.error({ 
                userId, 
                fileName: file.originalname,
                documentId: document.id,
                error: dbError 
              }, 'Failed to save module to database');
              
              reject(dbError);
            }
          }
        });

        worker.on('error', (error) => {
          clearTimeout(timeout);
          logger.error({ 
            userId, 
            fileName: file.originalname,
            documentId: document.id,
            error: error.message 
          }, 'Worker error during file processing');
          
          reject(error);
        });

        worker.on('exit', (code) => {
          // Remove from tracking set regardless of outcome
          activeWorkers.delete(worker);
          clearTimeout(timeout);
          if (code !== 0) {
            logger.error({ 
              userId, 
              fileName: file.originalname,
              documentId: document.id,
              exitCode: code 
            }, 'Worker exited with error code');
            
            reject(new Error(`Worker stopped with exit code ${code}`));
          }
        });
      });
    } catch (error) {
      logger.error({ 
        userId, 
        fileName: file.originalname, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to create module from file');
      throw error;
    }
  }

  async function getModule(moduleId: string): Promise<LearningModuleRecord> {
    const module = await learningRepository.getModuleById(moduleId);
    if (!module) {
      throw createNotFoundError('Learning module not found');
    }
    return module;
  }

  async function getModules(options: PaginationQuery) {
    return learningRepository.getModules(options);
  }

  async function deleteModule(moduleId: string): Promise<void> {
    const module = await learningRepository.getModuleById(moduleId);
    if (!module) {
      throw createNotFoundError('Learning module not found');
    }
    await learningRepository.deleteModule(moduleId);
  }

  async function startModule(userId: string, moduleId: string): Promise<UserProgressRecord> {
    // Check if module exists
    const module = await learningRepository.getModuleById(moduleId);
    if (!module) {
      throw createNotFoundError('Learning module not found');
    }

    // Check if user already has progress for this module
    const existingProgress = await learningRepository.getUserProgress(userId, moduleId);
    if (existingProgress) {
      const updatedData: Partial<UserModuleProgressData> = {
        progress: {
          ...existingProgress.data.progress,
          lastAccessedAt: new Date().toISOString(),
        },
      };
      return learningRepository.updateUserProgress(existingProgress.id, updatedData);
    }

    // Create new progress record
    const progressData: UserModuleProgressData = {
      userId,
      moduleId,
      progress: {
        status: 'in_progress',
        completionPercentage: 0,
        currentSectionIndex: 0,
        startedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        timeSpent: 0,
        sectionProgress: [],
      },
    };

    logger.info({ userId, moduleId }, 'Starting new module for user');
    return learningRepository.createUserProgress(progressData);
  }

  async function updateProgress(userId: string, data: UpdateProgressData): Promise<UserProgressRecord> {
    const existingProgress = await learningRepository.getUserProgress(userId, data.moduleId);
    if (!existingProgress) {
      throw createNotFoundError('User progress not found for this module');
    }

    // Update progress data
    const updatedProgressData: Partial<UserModuleProgressData> = {
      progress: {
        ...existingProgress.data.progress,
        lastAccessedAt: new Date().toISOString(),
        ...(data.completed !== undefined && { 
          status: data.completed ? 'completed' : existingProgress.data.progress.status,
          completedAt: data.completed ? new Date().toISOString() : existingProgress.data.progress.completedAt 
        }),
        ...(data.sectionIndex !== undefined && { currentSectionIndex: data.sectionIndex }),
        ...(data.timeSpent !== undefined && { 
          timeSpent: existingProgress.data.progress.timeSpent + data.timeSpent 
        }),
      },
    };

    // Calculate completion percentage if not provided
    if (data.completed) {
      updatedProgressData.progress!.completionPercentage = 100;
    }

    logger.info({ 
      userId, 
      moduleId: data.moduleId, 
      sectionIndex: data.sectionIndex,
      completed: data.completed 
    }, 'Updating user progress');

    return learningRepository.updateUserProgress(existingProgress.id, updatedProgressData);
  }

  async function getUserProgress(userId: string, moduleId: string): Promise<UserProgressRecord> {
    const progress = await learningRepository.getUserProgress(userId, moduleId);
    if (!progress) {
      throw createNotFoundError('User progress not found for this module');
    }
    return progress;
  }

  async function getUserProgressList(userId: string, options: UserProgressQuery): Promise<UserProgressRecord[]> {
    return learningRepository.getUserProgressList(userId, options);
  }

  async function getOngoingModules(userId: string): Promise<UserProgressRecord[]> {
    return learningRepository.getUserProgressList(userId, { status: 'in_progress' });
  }

  async function submitAssessment(userId: string, data: SubmitAssessmentData): Promise<AssessmentResult> {
    // Get the module to retrieve assessment questions
    const module = await learningRepository.getModuleById(data.moduleId);
    if (!module) {
      throw createNotFoundError('Learning module not found');
    }

    // Get user progress
    const progress = await learningRepository.getUserProgress(userId, data.moduleId);
    if (!progress) {
      throw createNotFoundError('User progress not found for this module');
    }

    logger.info({ 
      userId, 
      moduleId: data.moduleId, 
      answersCount: data.answers.length 
    }, 'Evaluating user assessment');

    // Evaluate assessment using OpenRouter
    const assessmentQuestions = module.data.assessment || [];
    const result = await openRouterClient.evaluateUserAssessment(
      assessmentQuestions as AssessmentQuestionData[], 
      data.answers
    );

    // Update user progress with assessment results
    const assessmentScore = (result.score / result.totalQuestions) * 100;
    const updatedProgressData: Partial<UserModuleProgressData> = {
      progress: {
        ...progress.data.progress,
        sectionProgress: [
          ...progress.data.progress.sectionProgress,
          {
            sectionIndex: -1, // Assessment section
            completed: true,
            timeSpent: 0, // Could be tracked from frontend
            quizScores: [assessmentScore],
          }
        ],
      },
    };

    await learningRepository.updateUserProgress(progress.id, updatedProgressData);

    logger.info({ 
      userId, 
      moduleId: data.moduleId, 
      score: result.score,
      percentage: assessmentScore 
    }, 'Assessment evaluation completed');

    return {
      score: result.score,
      totalQuestions: result.totalQuestions,
      percentage: assessmentScore,
      feedback: result.feedback,
    };
  }

  async function submitEvaluation(userId: string, data: SubmitEvaluationData): Promise<EvaluationResult> {
    // Get the module to retrieve evaluation questions
    const module = await learningRepository.getModuleById(data.moduleId);
    if (!module) {
      throw createNotFoundError('Learning module not found');
    }

    // Get user progress
    const progress = await learningRepository.getUserProgress(userId, data.moduleId);
    if (!progress) {
      throw createNotFoundError('User progress not found for this module');
    }

    const evaluationQuestions = module.data.evaluation || [];
    if (data.questionIndex >= evaluationQuestions.length || data.questionIndex < 0) {
      throw createBusinessLogicError('Invalid question index');
    }

    const question = evaluationQuestions[data.questionIndex] as EvaluationQuestionData;

    logger.info({ 
      userId, 
      moduleId: data.moduleId, 
      questionIndex: data.questionIndex 
    }, 'Evaluating user response to evaluation question');

    // Evaluate response using OpenRouter
    const result = await openRouterClient.evaluateUserResponse(question, data.response);

    logger.info({ 
      userId, 
      moduleId: data.moduleId, 
      questionIndex: data.questionIndex,
      score: result.score 
    }, 'Evaluation response assessment completed');

    return result;
  }

  async function getModuleStats(moduleId: string) {
    return learningRepository.getModuleStats(moduleId);
  }

  async function getUserStats(userId: string) {
    return learningRepository.getUserStats(userId);
  }

  return {
    createModuleFromFile,
    getModule,
    getModules,
    deleteModule,
    startModule,
    updateProgress,
    getUserProgress,
    getUserProgressList,
    getOngoingModules,
    submitAssessment,
    submitEvaluation,
    getModuleStats,
    getUserStats,
  };
} 