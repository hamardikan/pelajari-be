import { z } from 'zod';

// Flashcard schema
export const flashcardSchema = z.object({
  term: z.string().min(1, 'Term is required'),
  definition: z.string().min(1, 'Definition is required'),
});

// Assessment question schema
export const assessmentQuestionSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  options: z.array(z.string().min(1)).min(2, 'At least 2 options required').max(6, 'Maximum 6 options allowed'),
  correctAnswer: z.string().min(1, 'Correct answer is required'),
  explanation: z.string().min(1, 'Explanation is required'),
});

// Evaluation question schema
export const evaluationQuestionSchema = z.object({
  scenario: z.string().min(1, 'Scenario is required'),
  question: z.string().min(1, 'Question is required'),
  sampleAnswer: z.string().min(1, 'Sample answer is required'),
  evaluationCriteria: z.array(z.string().min(1)).min(1, 'At least one evaluation criterion required'),
});

// Learning module content schema
export const learningModuleContentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  summary: z.string().min(1, 'Summary is required'),
  flashcards: z.array(flashcardSchema).min(1, 'At least one flashcard required'),
  assessment: z.array(assessmentQuestionSchema).min(1, 'At least one assessment question required'),
  evaluation: z.array(evaluationQuestionSchema).min(1, 'At least one evaluation question required'),
});

// File upload schema
export const createModuleFromFileSchema = z.object({
  file: z.any()
    .refine((file) => file != null, 'File is required')
    .refine(
      (file) => file?.mimetype === 'application/pdf' || file?.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'File must be PDF or DOCX format'
    )
    .refine((file) => file?.size <= 10 * 1024 * 1024, 'File size must be less than 10MB'),
});

// Assessment submission schema
export const submitAssessmentSchema = z.object({
  moduleId: z.string().uuid('Invalid module ID'),
  answers: z.array(z.string()).min(1, 'At least one answer required'),
});

// Evaluation submission schema
export const submitEvaluationSchema = z.object({
  moduleId: z.string().uuid('Invalid module ID'),
  questionIndex: z.number().int().min(0, 'Question index must be non-negative'),
  response: z.string().min(10, 'Response must be at least 10 characters'),
});

// Progress update schema
export const updateProgressSchema = z.object({
  moduleId: z.string().uuid('Invalid module ID'),
  sectionIndex: z.number().int().min(0, 'Section index must be non-negative').optional(),
  completed: z.boolean().optional(),
  timeSpent: z.number().min(0, 'Time spent must be non-negative').optional(),
});

// Query schemas
export const moduleIdParamsSchema = z.object({
  moduleId: z.string().uuid('Invalid module ID'),
});

export const paginationQuerySchema = z.object({
  page: z.string().transform(Number).refine(n => n > 0, 'Page must be positive').default('1'),
  limit: z.string().transform(Number).refine(n => n > 0 && n <= 50, 'Limit must be between 1-50').default('10'),
  search: z.string().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
});

// User progress query schema
export const userProgressQuerySchema = z.object({
  userId: z.string().uuid('Invalid user ID').optional(),
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
});

// Type exports
export type FlashcardData = z.infer<typeof flashcardSchema>;
export type AssessmentQuestionData = z.infer<typeof assessmentQuestionSchema>;
export type EvaluationQuestionData = z.infer<typeof evaluationQuestionSchema>;
export type LearningModuleContentData = z.infer<typeof learningModuleContentSchema>;
export type CreateModuleFromFileData = z.infer<typeof createModuleFromFileSchema>;
export type SubmitAssessmentData = z.infer<typeof submitAssessmentSchema>;
export type SubmitEvaluationData = z.infer<typeof submitEvaluationSchema>;
export type UpdateProgressData = z.infer<typeof updateProgressSchema>;
export type ModuleIdParams = z.infer<typeof moduleIdParamsSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type UserProgressQuery = z.infer<typeof userProgressQuerySchema>;

// Schema collection for easy import
const learningSchemas = {
  flashcard: flashcardSchema,
  assessmentQuestion: assessmentQuestionSchema,
  evaluationQuestion: evaluationQuestionSchema,
  learningModuleContent: learningModuleContentSchema,
  createModuleFromFile: createModuleFromFileSchema,
  submitAssessment: submitAssessmentSchema,
  submitEvaluation: submitEvaluationSchema,
  updateProgress: updateProgressSchema,
  moduleIdParams: moduleIdParamsSchema,
  paginationQuery: paginationQuerySchema,
  userProgressQuery: userProgressQuerySchema,
};

export {
  learningSchemas,
}; 