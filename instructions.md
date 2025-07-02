## Project Overview
You are working on "Pelajari" - an AI-powered corporate learning and development platform built with Node.js/TypeScript, Express.js, PostgreSQL (via Drizzle ORM), and follows a 3-layer architecture pattern: **Handler → Service → Repository**.

## Current Architecture
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM 
- **Storage**: Cloudflare R2 for file storage
- **AI**: OpenRouter for AI processing
- **Pattern**: Handler → Service → Repository (NO routes files)
- **Data Structure**: Semi-relational with `(id uuid, data jsonb, timestamps)` pattern

## Database Redesign Task

### CRITICAL: Database Schema Changes Required

#### 1. Remove Unused Table
```sql
-- Remove this table completely from schema.ts
DROP TABLE IF EXISTS personal_development_plans;
```

#### 2. Keep and Implement ALL These Tables
```typescript
// In src/db/schema.ts - these are the ONLY tables needed:
export const users = pgTable('users', { /* existing */ });
export const documents = pgTable('documents', { /* needs implementation */ });
export const learningModules = pgTable('learning_modules', { /* existing */ });
export const userModuleProgress = pgTable('user_module_progress', { /* existing */ });
export const competencyGaps = pgTable('competency_gaps', { /* existing */ });
export const developmentPrograms = pgTable('development_programs', { /* existing */ });
export const individualDevelopmentPlans = pgTable('individual_development_plans', { /* existing */ });
export const roleplayScenarios = pgTable('roleplay_scenarios', { /* needs implementation */ });
export const roleplaySessions = pgTable('roleplay_sessions', { /* needs implementation */ });
export const deadLetterQueue = pgTable('dead_letter_queue', { /* existing */ });
```

## Implementation Tasks

### PHASE 1: Update Database Schema

#### Task 1.1: Update src/db/schema.ts
```typescript
// ADD these new type definitions:

export type DocumentData = {
  title: string;
  originalFilename: string;
  storagePath: string; // R2 storage path  
  fileType: 'pdf' | 'docx' | 'txt' | 'pptx';
  uploadedBy: string; // userId
  fileSize: number;
  uploadedAt: string;
  metadata: {
    extractedText?: string; // Cached extracted text
    processingStatus: 'pending' | 'completed' | 'failed';
    lastProcessedAt?: string;
    tags: string[];
    description?: string;
  };
  usage: {
    learningModulesGenerated: string[]; // array of learning module IDs
    developmentProgramsReferenced: string[]; // array of development program IDs  
    idpAnalysisUsed: string[]; // array of IDP analysis IDs
  };
};

export type RoleplayScenarioData = {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number; // minutes
  targetCompetencies: string[];
  scenario: {
    context: string;
    setting: string;
    yourRole: string;
    aiRole: string;
    objectives: string[];
    successCriteria: string[];
  };
  systemPrompt: string; // AI instructions for roleplay
  evaluationCriteria: {
    communicationSkills: string[];
    problemSolving: string[];
    leadership: string[];
    technicalKnowledge: string[];
    [key: string]: string[];
  };
  tags: string[];
  authorId: string;
  isPublished: boolean;
  usage: {
    timesUsed: number;
    averageScore: number;
    lastUsedAt?: string;
  };
};

export type RoleplaySessionData = {
  userId: string;
  scenarioId: string;
  sessionData: {
    startedAt: string;
    endedAt?: string;
    status: 'active' | 'completed' | 'abandoned';
    totalDuration?: number; // minutes
    messages: Array<{
      id: string;
      timestamp: string;
      sender: 'user' | 'ai';
      content: string;
      metadata?: {
        tone?: string;
        confidence?: number;
      };
    }>;
    evaluation?: {
      overallScore: number;
      competencyScores: Record<string, number>;
      strengths: string[];
      areasForImprovement: string[];
      detailedFeedback: string;
      recommendations: string[];
    };
  };
  context: {
    idpId?: string; // If part of IDP execution
    developmentProgramId?: string; // If part of development program
  };
};

// UPDATE LearningModuleData to include sourceDocumentId:
export type LearningModuleData = {
  title: string;
  description?: string;
  summary: string;
  sourceDocumentId?: string; // NEW: Reference to documents table
  authorId: string;
  isPublished: boolean;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
  tags: string[];
  prerequisites: string[];
  content: {
    sections: Array<{
      title: string;
      content: string;
      type: 'text' | 'video' | 'quiz' | 'interactive';
      duration?: number;
    }>;
    flashcards: Array<{
      term: string;
      definition: string;
    }>;
    assessment: Array<{
      question: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
    }>;
    evaluation: Array<{
      scenario: string;
      question: string;
      sampleAnswer: string;
      evaluationCriteria: string[];
    }>;
  };
  // Keep these for backward compatibility
  flashcards: Array<{ term: string; definition: string; }>;
  assessment: Array<{ question: string; options: string[]; correctAnswer: string; explanation: string; }>;
  evaluation: Array<{ scenario: string; question: string; sampleAnswer: string; evaluationCriteria: string[]; }>;
};
```

#### Task 1.2: Remove personal_development_plans
- Delete ALL references to `personalDevelopmentPlans` table
- Remove from schema.ts completely
- Update any imports that reference it

### PHASE 2: Create Documents Module

#### Task 2.1: Create src/documents/documents.schemas.ts
```typescript
import { z } from 'zod';

export const createDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).max(10).optional().default([]),
});

export const documentIdParamsSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).max(10).optional(),
});

export const documentsQuerySchema = z.object({
  page: z.string().transform(Number).refine(n => n > 0).default('1'),
  limit: z.string().transform(Number).refine(n => n > 0 && n <= 50).default('10'),
  search: z.string().optional(),
  fileType: z.enum(['pdf', 'docx', 'txt', 'pptx']).optional(),
  uploadedBy: z.string().uuid().optional(),
});

// Type exports
export type CreateDocumentData = z.infer<typeof createDocumentSchema>;
export type DocumentIdParams = z.infer<typeof documentIdParamsSchema>;
export type UpdateDocumentData = z.infer<typeof updateDocumentSchema>;
export type DocumentsQuery = z.infer<typeof documentsQuerySchema>;
```

#### Task 2.2: Create src/documents/documents.repositories.ts
```typescript
import { eq, and, ilike, sql } from 'drizzle-orm';
import type { Database } from '../config/database.js';
import type { Logger } from 'pino';
import { documents } from '../db/schema.js';
import type { DocumentData } from '../db/schema.js';
import type { DocumentsQuery } from './documents.schemas.js';

export type DocumentRecord = {
  id: string;
  data: DocumentData;
  createdAt: Date;
  updatedAt: Date;
};

export type DocumentRepository = {
  createDocument: (documentData: DocumentData) => Promise<DocumentRecord>;
  getDocumentById: (id: string) => Promise<DocumentRecord | null>;
  getDocuments: (options: DocumentsQuery) => Promise<{
    documents: DocumentRecord[];
    total: number;
    page: number;
    limit: number;
  }>;
  updateDocument: (id: string, documentData: Partial<DocumentData>) => Promise<DocumentRecord>;
  deleteDocument: (id: string) => Promise<void>;
  updateDocumentUsage: (id: string, usageType: string, referenceId: string) => Promise<void>;
  getDocumentsByUsage: (usageType: string, referenceId: string) => Promise<DocumentRecord[]>;
};

export function createDocumentRepository(db: Database, logger: Logger): DocumentRepository {
  // Implement all methods following the same pattern as other repositories
  // Use the same JSONB pattern: eq(sql`${documents.data}->>'field'`, value)
  
  async function createDocument(documentData: DocumentData): Promise<DocumentRecord> {
    // Implementation similar to other repositories
  }
  
  async function getDocumentById(id: string): Promise<DocumentRecord | null> {
    // Implementation similar to other repositories  
  }
  
  // ... implement all other methods
  
  return {
    createDocument,
    getDocumentById,
    getDocuments,
    updateDocument,
    deleteDocument,
    updateDocumentUsage,
    getDocumentsByUsage,
  };
}
```

#### Task 2.3: Create src/documents/documents.services.ts
```typescript
import type { Logger } from 'pino';
import type { DocumentRepository, DocumentRecord } from './documents.repositories.js';
import type { R2Client } from '../shared/utils/r2.js';
import type { CreateDocumentData, UpdateDocumentData, DocumentsQuery } from './documents.schemas.js';
import type { DocumentData } from '../db/schema.js';
import { createNotFoundError, createBusinessLogicError } from '../shared/middleware/error.middleware.js';

export type FileUploadData = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export type DocumentService = {
  uploadDocument: (userId: string, file: FileUploadData, metadata: CreateDocumentData) => Promise<DocumentRecord>;
  getDocument: (documentId: string) => Promise<DocumentRecord>;
  getDocuments: (options: DocumentsQuery) => Promise<{
    documents: DocumentRecord[];
    total: number;
    page: number;
    limit: number;
  }>;
  updateDocument: (documentId: string, updateData: UpdateDocumentData) => Promise<DocumentRecord>;
  deleteDocument: (documentId: string) => Promise<void>;
  getDocumentContent: (documentId: string) => Promise<string>; // Get file URL or extracted text
  markDocumentUsed: (documentId: string, usageType: 'learning_module' | 'development_program' | 'idp_analysis', referenceId: string) => Promise<void>;
};

export function createDocumentService(
  documentRepository: DocumentRepository,
  r2Client: R2Client,
  logger: Logger
): DocumentService {
  
  async function uploadDocument(userId: string, file: FileUploadData, metadata: CreateDocumentData): Promise<DocumentRecord> {
    try {
      logger.info({ userId, fileName: file.originalname, fileSize: file.size }, 'Uploading document');
      
      // Upload file to R2
      const storagePath = await r2Client.uploadFile(file.buffer, file.originalname, file.mimetype);
      
      // Determine file type
      const fileType = getFileTypeFromMimetype(file.mimetype);
      
      // Create document data
      const documentData: DocumentData = {
        title: metadata.title,
        originalFilename: file.originalname,
        storagePath,
        fileType,
        uploadedBy: userId,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        metadata: {
          processingStatus: 'pending',
          tags: metadata.tags || [],
          description: metadata.description,
        },
        usage: {
          learningModulesGenerated: [],
          developmentProgramsReferenced: [],
          idpAnalysisUsed: [],
        },
      };
      
      const newDocument = await documentRepository.createDocument(documentData);
      logger.info({ documentId: newDocument.id, userId }, 'Document uploaded successfully');
      
      return newDocument;
    } catch (error) {
      logger.error({ error, userId, fileName: file.originalname }, 'Failed to upload document');
      throw error;
    }
  }
  
  // Implement other methods...
  
  return {
    uploadDocument,
    getDocument,
    getDocuments,
    updateDocument,
    deleteDocument,
    getDocumentContent,
    markDocumentUsed,
  };
}

function getFileTypeFromMimetype(mimetype: string): 'pdf' | 'docx' | 'txt' | 'pptx' {
  // Implementation to map mimetype to file type
}
```

#### Task 2.4: Create src/documents/documents.handlers.ts
```typescript
import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import type { DocumentService, FileUploadData } from './documents.services.js';
import type { RequestWithCorrelation } from '../config/logger.js';
import { createAsyncErrorWrapper } from '../shared/middleware/error.middleware.js';

export type DocumentHandlerDependencies = {
  documentService: DocumentService;
  logger: Logger;
};

export type DocumentHandlers = {
  uploadDocument: (req: Request, res: Response, next: NextFunction) => void;
  getDocument: (req: Request, res: Response, next: NextFunction) => void;
  getDocuments: (req: Request, res: Response, next: NextFunction) => void;
  updateDocument: (req: Request, res: Response, next: NextFunction) => void;
  deleteDocument: (req: Request, res: Response, next: NextFunction) => void;
  getDocumentContent: (req: Request, res: Response, next: NextFunction) => void;
};

function createDocumentHandlers(dependencies: DocumentHandlerDependencies): DocumentHandlers {
  const { documentService, logger } = dependencies;

  async function uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const userId = 'user-123'; // TODO: Get from authentication middleware
      
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

      const metadata = req.body; // Should be validated by middleware

      logger.info({ correlationId, userId, fileName: fileData.originalname }, 'Processing document upload');
      
      const document = await documentService.uploadDocument(userId, fileData, metadata);
      
      logger.info({ correlationId, documentId: document.id }, 'Document uploaded successfully');
      
      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        data: { document },
        correlationId,
      });
    } catch (error) {
      logger.error({ correlationId, fileName: req.file?.originalname, error: error instanceof Error ? error.message : 'Unknown error' }, 'Document upload failed');
      next(error);
    }
  }

  // Implement other handlers following the same pattern...

  return {
    uploadDocument: createAsyncErrorWrapper(uploadDocument),
    getDocument: createAsyncErrorWrapper(getDocument),
    getDocuments: createAsyncErrorWrapper(getDocuments),
    updateDocument: createAsyncErrorWrapper(updateDocument),
    deleteDocument: createAsyncErrorWrapper(deleteDocument),
    getDocumentContent: createAsyncErrorWrapper(getDocumentContent),
  };
}

export { createDocumentHandlers };
```

### PHASE 3: Create Roleplay Module

#### Task 3.1: Create src/roleplay/roleplay.schemas.ts
```typescript
import { z } from 'zod';

export const createRoleplayScenarioSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  estimatedDuration: z.number().min(5).max(180), // 5-180 minutes
  targetCompetencies: z.array(z.string()).min(1, 'At least one competency required'),
  scenario: z.object({
    context: z.string().min(20),
    setting: z.string().min(10),
    yourRole: z.string().min(10),
    aiRole: z.string().min(10),
    objectives: z.array(z.string()).min(1),
    successCriteria: z.array(z.string()).min(1),
  }),
  systemPrompt: z.string().min(50, 'System prompt must be detailed'),
  evaluationCriteria: z.record(z.array(z.string())),
  tags: z.array(z.string()).optional().default([]),
});

export const startRoleplaySessionSchema = z.object({
  scenarioId: z.string().uuid('Invalid scenario ID'),
  context: z.object({
    idpId: z.string().uuid().optional(),
    developmentProgramId: z.string().uuid().optional(),
  }).optional().default({}),
});

export const sendMessageSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  message: z.string().min(1, 'Message cannot be empty').max(1000),
});

// Type exports
export type CreateRoleplayScenarioData = z.infer<typeof createRoleplayScenarioSchema>;
export type StartRoleplaySessionData = z.infer<typeof startRoleplaySessionSchema>;
export type SendMessageData = z.infer<typeof sendMessageSchema>;
```

#### Task 3.2: Create complete roleplay module following the same pattern
- `src/roleplay/roleplay.repositories.ts`
- `src/roleplay/roleplay.services.ts` 
- `src/roleplay/roleplay.handlers.ts`

### PHASE 4: Update Learning Module

#### Task 4.1: Update src/learning/learning.services.ts
```typescript
// MODIFY the createModuleFromFile method:

async function createModuleFromFile(userId: string, file: FileUploadData): Promise<ModuleCreationResult> {
  try {
    logger.info({ userId, fileName: file.originalname }, 'Starting module creation from file');

    // STEP 1: Upload document first using document service
    const document = await documentService.uploadDocument(userId, file, {
      title: `Source: ${file.originalname}`,
      description: 'Document uploaded for learning module generation',
      tags: ['learning-source'],
    });

    // STEP 2: Process with AI using the document
    const workerPath = path.join(__dirname, '../workers/learning.worker.js');
    const worker = new Worker(workerPath, {
      workerData: { 
        documentId: document.id,
        pdfBuffer: file.buffer,
        fileName: file.originalname,
        userId 
      },
    });

    return new Promise((resolve, reject) => {
      // ... existing worker logic

      worker.on('message', async (message) => {
        if (message.error) {
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
              difficulty: 'intermediate',
              estimatedDuration: message.content.flashcards.length * 2 + message.content.assessment.length * 3,
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
            
            resolve({
              moduleId: newModule.id,
              documentId: document.id, // NEW: Return document ID too
              status: 'completed',
              message: 'Module created successfully'
            });
          } catch (dbError) {
            reject(dbError);
          }
        }
      });
    });
  } catch (error) {
    throw error;
  }
}
```

### PHASE 5: Update Main Application

#### Task 5.1: Update src/app.ts
```typescript
// ADD document service creation:
import { createDocumentRepository } from './documents/documents.repositories.js';
import { createDocumentService } from './documents/documents.services.js';
import { createDocumentHandlers } from './documents/documents.handlers.js';

// ADD roleplay service creation:
import { createRoleplayRepository } from './roleplay/roleplay.repositories.js';
import { createRoleplayService } from './roleplay/roleplay.services.js';
import { createRoleplayHandlers } from './roleplay/roleplay.handlers.js';

// In createApp function, add after existing repositories:
const documentRepository = createDocumentRepository(db, logger);
const roleplayRepository = createRoleplayRepository(db, logger);

// Add after existing services:
const documentService = createDocumentService(documentRepository, r2Client, logger);
const roleplayService = createRoleplayService(roleplayRepository, openRouterClient, logger);

// Add after existing handlers:
const documentHandlers = createDocumentHandlers({ documentService, logger });
const roleplayHandlers = createRoleplayHandlers({ roleplayService, logger });

// Update learning service creation to include documentService:
const learningService = createLearningService(
  learningRepository,
  documentService, // NEW: Add document service
  r2Client,
  openRouterClient,
  logger
);

// ADD new API endpoints (using handlers directly, not routes):
import multer from 'multer';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Document endpoints
app.post('/api/documents', upload.single('file'), validateBody(createDocumentSchema), documentHandlers.uploadDocument);
app.get('/api/documents', validateQuery(documentsQuerySchema), documentHandlers.getDocuments);
app.get('/api/documents/:documentId', validateParams(documentIdParamsSchema), documentHandlers.getDocument);
app.put('/api/documents/:documentId', validateParams(documentIdParamsSchema), validateBody(updateDocumentSchema), documentHandlers.updateDocument);
app.delete('/api/documents/:documentId', validateParams(documentIdParamsSchema), documentHandlers.deleteDocument);
app.get('/api/documents/:documentId/content', validateParams(documentIdParamsSchema), documentHandlers.getDocumentContent);

// Roleplay endpoints
app.post('/api/roleplay/scenarios', validateBody(createRoleplayScenarioSchema), roleplayHandlers.createScenario);
app.get('/api/roleplay/scenarios', roleplayHandlers.getScenarios);
app.get('/api/roleplay/scenarios/:scenarioId', validateParams(scenarioIdParamsSchema), roleplayHandlers.getScenario);
app.post('/api/roleplay/sessions', validateBody(startRoleplaySessionSchema), roleplayHandlers.startSession);
app.post('/api/roleplay/sessions/message', validateBody(sendMessageSchema), roleplayHandlers.sendMessage);
app.get('/api/roleplay/sessions/:sessionId', validateParams(sessionIdParamsSchema), roleplayHandlers.getSession);
```

## Coding Standards & Patterns

### 1. Follow Existing Patterns
- **Repository Pattern**: Use same JSONB query pattern: `eq(sql\`${table.data}->>'field'\`, value)`
- **Service Pattern**: Business logic only, call repositories and external services
- **Handler Pattern**: HTTP request/response handling, validation, correlation ID logging
- **Error Handling**: Use `createAsyncErrorWrapper` for all async handlers

### 2. Logging Standards
```typescript
// Always include correlationId and relevant context
logger.info({ correlationId, userId, documentId }, 'Action description');
logger.error({ correlationId, error: error instanceof Error ? error.message : 'Unknown error' }, 'Error description');
```

### 3. Response Format
```typescript
// Consistent response format
res.status(200).json({
  success: true,
  message: 'Operation successful',
  data: { result },
  correlationId,
});
```

### 4. Validation
- Use Zod schemas for ALL input validation
- Validate at handler level using middleware
- Always use `validateBody`, `validateParams`, `validateQuery` middleware

### 5. File Uploads
- Use multer middleware for file handling
- Always validate file type and size
- Store files in R2, keep metadata in database

## Testing Requirements

### Unit Tests
- Test all service methods with mocked dependencies
- Test repository methods with test database
- Test handler responses and error cases

### Integration Tests  
- Test complete workflows (file upload → document creation → learning module generation)
- Test roleplay session flow
- Test IDP integration with documents and roleplay

## Important Notes

1. **NO Routes Files**: We use handlers directly in app.ts, not separate route files
2. **Maintain Backward Compatibility**: Don't break existing APIs during updates
3. **Transaction Safety**: Use database transactions for multi-step operations
4. **Error Resilience**: Use existing resilience patterns for external API calls
5. **Security**: Always validate user permissions (use userId from auth middleware)
6. **Performance**: Consider caching for frequently accessed documents
7. **Documentation**: Update type definitions and add JSDoc comments for public methods

## File Structure Reference
```
src/
├── documents/
│   ├── documents.schemas.ts
│   ├── documents.repositories.ts
│   ├── documents.services.ts
│   └── documents.handlers.ts
├── roleplay/
│   ├── roleplay.schemas.ts
│   ├── roleplay.repositories.ts
│   ├── roleplay.services.ts
│   └── roleplay.handlers.ts
├── learning/ (existing - update services)
├── idp/ (existing)
├── auth/ (existing)
├── db/
│   └── schema.ts (update)
└── app.ts (update)
```

This comprehensive instruction ensures the cursor agent understands the complete architecture, patterns, and implementation requirements for the database redesign and new module development.