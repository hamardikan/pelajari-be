import { pgTable, uuid, jsonb, timestamp } from 'drizzle-orm/pg-core';

// Users table - stores user account information and profile data
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Documents table - stores learning materials and documents
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Learning modules table - stores structured learning content
export const learningModules = pgTable('learning_modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Roleplay scenarios table - stores roleplay scenario definitions
export const roleplayScenarios = pgTable('roleplay_scenarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Roleplay sessions table - stores user roleplay session data
export const roleplaySessions = pgTable('roleplay_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User module progress table - tracks user progress through learning modules
export const userModuleProgress = pgTable('user_module_progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Dead letter queue table - stores failed operations for retry
export const deadLetterQueue = pgTable('dead_letter_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Competency gaps table - stores AI gap analysis results
export const competencyGaps = pgTable('competency_gaps', {
  id: uuid('id').primaryKey().defaultRandom(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Development programs table - stores catalog of available development programs
export const developmentPrograms = pgTable('development_programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Individual development plans table - stores AI-generated IDP documents
export const individualDevelopmentPlans = pgTable('individual_development_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Type definitions for the data structure
export type UserData = {
  email: string;
  hashedPassword: string;
  name: string;
  role: 'user' | 'manager';
  managerId?: string;
  isActive: boolean;
  lastLoginAt?: string;
  profileData: {
    avatar?: string;
    bio?: string;
    skills: string[];
    goals: string[];
    nineBoxClassification?: 'Low Performer' | 'Inconsistent Performer' | 'High Performer' | 'Emerging Talent' | 'Core Player' | 'High Professional' | 'Rising Star' | 'Key Player' | 'Top Talent';
  };
};

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

export type UserModuleProgressData = {
  userId: string;
  moduleId: string;
  progress: {
    status: 'not_started' | 'in_progress' | 'completed';
    completionPercentage: number;
    currentSectionIndex: number;
    startedAt: string;
    completedAt?: string;
    timeSpent: number;
    sectionProgress: Array<{
      sectionIndex: number;
      completed: boolean;
      timeSpent: number;
      quizScores?: number[];
    }>;
  };
};

export type DeadLetterQueueData = {
  operation: string;
  payload: Record<string, unknown>;
  error: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string;
  status: 'pending' | 'processing' | 'failed' | 'success';
};

// IDP-related type definitions
export type CompetencyGapData = {
  employeeId: string;
  employeeName: string;
  jobTitle: string;
  analysisDate: string;
  kpiScore: number; // Performance score from employee data
  potentialScore: number; // Assessment/potential score from employee data
  gaps: Array<{
    competency: string;
    category: 'managerial' | 'functional';
    requiredLevel: 'Basic' | 'Intermediate' | 'Advanced';
    currentLevel: 'Basic' | 'Intermediate' | 'Advanced';
    gapLevel: number; // 0 = no gap, 1 = minor, 2 = major
    description: string;
    priority: 'Low' | 'Medium' | 'High';
  }>;
  nineBoxClassification: 'Low Performer' | 'Inconsistent Performer' | 'High Performer' | 'Emerging Talent' | 'Core Player' | 'High Professional' | 'Rising Star' | 'Key Player' | 'Top Talent';
  overallGapScore: number;
  recommendations: string[];
  createdBy: string;
};

export type DevelopmentProgramData = {
  name: string;
  type: 'Coaching' | 'Mentoring' | 'Training' | 'Job Rotation' | 'Special Assignment' | 'Online Course';
  description: string;
  duration: string;
  targetCompetencies: string[];
  provider?: string;
  cost?: number;
  prerequisites?: string[];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  format: 'In-Person' | 'Online' | 'Hybrid';
  capacity?: number;
  isActive: boolean;
  createdBy: string;
};

export type IndividualDevelopmentPlanData = {
  employeeId: string;
  employeeName: string;
  managerId?: string;
  title: string;
  description: string;
  gapAnalysisId: string;
  nineBoxClassification: 'Low Performer' | 'Inconsistent Performer' | 'High Performer' | 'Emerging Talent' | 'Core Player' | 'High Professional' | 'Rising Star' | 'Key Player' | 'Top Talent';
  developmentGoals: Array<{
    id: string;
    competency: string;
    currentLevel: 'Basic' | 'Intermediate' | 'Advanced';
    targetLevel: 'Basic' | 'Intermediate' | 'Advanced';
    priority: 'Low' | 'Medium' | 'High';
    timeframe: string;
    description: string;
    programs: Array<{
      programId: string;
      programName: string;
      type: 'Coaching' | 'Mentoring' | 'Training' | 'Job Rotation' | 'Special Assignment' | 'Online Course';
      status: 'Not Started' | 'In Progress' | 'Completed';
      startDate?: string;
      endDate?: string;
      completionPercentage: number;
      notes?: string;
    }>;
    successMetrics: string[];
  }>;
  overallProgress: {
    status: 'Draft' | 'Active' | 'In Progress' | 'Completed' | 'On Hold';
    completionPercentage: number;
    startDate?: string;
    targetCompletionDate?: string;
    actualCompletionDate?: string;
  };
  approvedByManager: boolean;
  managerComments?: string;
  approvalDate?: string;
  createdBy: string;
  lastReviewDate?: string;
  nextReviewDate?: string;
}; 