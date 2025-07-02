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

// Personal development plans table - stores user development plans
export const personalDevelopmentPlans = pgTable('personal_development_plans', {
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
  };
};

export type DocumentData = {
  title: string;
  content: string;
  type: 'policy' | 'procedure' | 'guideline' | 'training_material';
  tags: string[];
  authorId: string;
  isPublished: boolean;
  version: number;
  metadata: {
    department?: string;
    audience: string[];
    lastReviewedAt?: string;
  };
};

export type LearningModuleData = {
  title: string;
  description: string;
  content: {
    sections: Array<{
      title: string;
      content: string;
      type: 'text' | 'video' | 'quiz' | 'interactive';
      duration?: number;
    }>;
  };
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
  tags: string[];
  prerequisites: string[];
  authorId: string;
  isPublished: boolean;
};

export type PersonalDevelopmentPlanData = {
  userId: string;
  title: string;
  description: string;
  goals: Array<{
    id: string;
    title: string;
    description: string;
    targetDate: string;
    status: 'not_started' | 'in_progress' | 'completed';
    milestones: Array<{
      id: string;
      title: string;
      completed: boolean;
      completedAt?: string;
    }>;
  }>;
  createdBy: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
};

export type RoleplayScenarioData = {
  title: string;
  description: string;
  scenario: {
    context: string;
    characters: Array<{
      name: string;
      role: string;
      personality: string;
      background: string;
    }>;
    objectives: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  };
  tags: string[];
  authorId: string;
  isPublished: boolean;
};

export type RoleplaySessionData = {
  userId: string;
  scenarioId: string;
  sessionData: {
    startedAt: string;
    endedAt?: string;
    status: 'active' | 'completed' | 'abandoned';
    messages: Array<{
      id: string;
      timestamp: string;
      sender: 'user' | 'ai';
      content: string;
      metadata?: Record<string, unknown>;
    }>;
    feedback?: {
      overallScore: number;
      areas: Array<{
        category: string;
        score: number;
        feedback: string;
      }>;
      suggestions: string[];
    };
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