import { eq, and, ilike, sql } from 'drizzle-orm';
import type { Database } from '../config/database.js';
import type { Logger } from 'pino';
import { learningModules, userModuleProgress } from '../db/schema.js';
import type { LearningModuleData, UserModuleProgressData } from '../db/schema.js';
import type { PaginationQuery, UserProgressQuery } from './learning.schemas.js';

export type LearningModuleRecord = {
  id: string;
  data: LearningModuleData;
  createdAt: Date;
  updatedAt: Date;
};

export type UserProgressRecord = {
  id: string;
  data: UserModuleProgressData;
  createdAt: Date;
  updatedAt: Date;
};

export type LearningRepository = {
  // Learning modules
  createModule: (moduleData: LearningModuleData) => Promise<LearningModuleRecord>;
  getModuleById: (id: string) => Promise<LearningModuleRecord | null>;
  getModules: (options: PaginationQuery) => Promise<{
    modules: LearningModuleRecord[];
    total: number;
    page: number;
    limit: number;
  }>;
  updateModule: (id: string, moduleData: Partial<LearningModuleData>) => Promise<LearningModuleRecord>;
  deleteModule: (id: string) => Promise<void>;
  
  // User progress
  createUserProgress: (progressData: UserModuleProgressData) => Promise<UserProgressRecord>;
  getUserProgress: (userId: string, moduleId: string) => Promise<UserProgressRecord | null>;
  updateUserProgress: (id: string, progressData: Partial<UserModuleProgressData>) => Promise<UserProgressRecord>;
  getUserProgressList: (userId: string, options: UserProgressQuery) => Promise<UserProgressRecord[]>;
  deleteUserProgress: (id: string) => Promise<void>;
  
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

export function createLearningRepository(db: Database, logger: Logger): LearningRepository {
  // Learning modules methods
  async function createModule(moduleData: LearningModuleData): Promise<LearningModuleRecord> {
    try {
      logger.info({ title: moduleData.title }, 'Creating new learning module');
      
      const result = await db
        .insert(learningModules)
        .values({ data: moduleData })
        .returning();

      const newModule = result[0];
      if (!newModule) {
        throw new Error('Failed to create learning module - no result returned');
      }
      
      logger.info({ moduleId: newModule.id, title: moduleData.title }, 'Learning module created successfully');

      return {
        id: newModule.id,
        data: newModule.data as LearningModuleData,
        createdAt: newModule.createdAt,
        updatedAt: newModule.updatedAt,
      };
    } catch (error) {
      logger.error({ error, title: moduleData.title }, 'Error creating learning module');
      throw error;
    }
  }

  async function getModuleById(id: string): Promise<LearningModuleRecord | null> {
    try {
      logger.debug({ moduleId: id }, 'Finding learning module by ID');
      
      const result = await db
        .select()
        .from(learningModules)
        .where(eq(learningModules.id, id))
        .limit(1);

      if (result.length === 0) {
        logger.debug({ moduleId: id }, 'Learning module not found by ID');
        return null;
      }

      const module = result[0];
      if (!module) {
        return null;
      }
      
      return {
        id: module.id,
        data: module.data as LearningModuleData,
        createdAt: module.createdAt,
        updatedAt: module.updatedAt,
      };
    } catch (error) {
      logger.error({ error, moduleId: id }, 'Error finding learning module by ID');
      throw error;
    }
  }

  async function getModules(options: PaginationQuery) {
    try {
      logger.debug({ options }, 'Finding learning modules with pagination');
      
      const offset = (options.page - 1) * options.limit;
      let whereConditions = [];
      
      if (options.search) {
        whereConditions.push(
          ilike(sql`${learningModules.data}->>'title'`, `%${options.search}%`)
        );
      }
      
      if (options.difficulty) {
        whereConditions.push(
          eq(sql`${learningModules.data}->>'difficulty'`, options.difficulty)
        );
      }

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      const [modulesResult, countResult] = await Promise.all([
        db
          .select()
          .from(learningModules)
          .where(whereClause)
          .limit(options.limit)
          .offset(offset)
          .orderBy(sql`${learningModules.createdAt} DESC`),
        db
          .select({ count: sql<number>`count(*)` })
          .from(learningModules)
          .where(whereClause)
      ]);

      const modules = modulesResult.map(module => ({
        id: module.id,
        data: module.data as LearningModuleData,
        createdAt: module.createdAt,
        updatedAt: module.updatedAt,
      }));

      const total = Number(countResult[0]?.count) || 0;

      logger.info({ 
        foundModules: modules.length, 
        total, 
        page: options.page, 
        limit: options.limit 
      }, 'Learning modules retrieved successfully');

      return {
        modules,
        total,
        page: options.page,
        limit: options.limit,
      };
    } catch (error) {
      logger.error({ error, options }, 'Error finding learning modules');
      throw error;
    }
  }

  async function updateModule(id: string, moduleData: Partial<LearningModuleData>): Promise<LearningModuleRecord> {
    try {
      logger.info({ moduleId: id }, 'Updating learning module');
      
      await db
        .update(learningModules)
        .set({
          data: sql`${learningModules.data} || ${JSON.stringify(moduleData)}`,
          updatedAt: new Date(),
        })
        .where(eq(learningModules.id, id));

      const updatedModule = await getModuleById(id);
      if (!updatedModule) {
        throw new Error('Learning module not found after update');
      }

      logger.info({ moduleId: id }, 'Learning module updated successfully');
      return updatedModule;
    } catch (error) {
      logger.error({ error, moduleId: id }, 'Error updating learning module');
      throw error;
    }
  }

  async function deleteModule(id: string): Promise<void> {
    try {
      logger.info({ moduleId: id }, 'Deleting learning module');
      
      await db
        .delete(learningModules)
        .where(eq(learningModules.id, id));

      logger.info({ moduleId: id }, 'Learning module deleted successfully');
    } catch (error) {
      logger.error({ error, moduleId: id }, 'Error deleting learning module');
      throw error;
    }
  }

  // User progress methods
  async function createUserProgress(progressData: UserModuleProgressData): Promise<UserProgressRecord> {
    try {
      logger.info({ 
        userId: progressData.userId, 
        moduleId: progressData.moduleId 
      }, 'Creating user progress record');
      
      const result = await db
        .insert(userModuleProgress)
        .values({ data: progressData })
        .returning();

      const newProgress = result[0];
      if (!newProgress) {
        throw new Error('Failed to create user progress - no result returned');
      }
      
      logger.info({ 
        progressId: newProgress.id,
        userId: progressData.userId, 
        moduleId: progressData.moduleId 
      }, 'User progress created successfully');

      return {
        id: newProgress.id,
        data: newProgress.data as UserModuleProgressData,
        createdAt: newProgress.createdAt,
        updatedAt: newProgress.updatedAt,
      };
    } catch (error) {
      logger.error({ 
        error, 
        userId: progressData.userId, 
        moduleId: progressData.moduleId 
      }, 'Error creating user progress');
      throw error;
    }
  }

  async function getUserProgress(userId: string, moduleId: string): Promise<UserProgressRecord | null> {
    try {
      logger.debug({ userId, moduleId }, 'Finding user progress');
      
      const result = await db
        .select()
        .from(userModuleProgress)
        .where(
          and(
            eq(sql`${userModuleProgress.data}->>'userId'`, userId),
            eq(sql`${userModuleProgress.data}->>'moduleId'`, moduleId)
          )
        )
        .limit(1);

      if (result.length === 0) {
        logger.debug({ userId, moduleId }, 'User progress not found');
        return null;
      }

      const progress = result[0];
      if (!progress) {
        return null;
      }
      
      return {
        id: progress.id,
        data: progress.data as UserModuleProgressData,
        createdAt: progress.createdAt,
        updatedAt: progress.updatedAt,
      };
    } catch (error) {
      logger.error({ error, userId, moduleId }, 'Error finding user progress');
      throw error;
    }
  }

  async function updateUserProgress(id: string, progressData: Partial<UserModuleProgressData>): Promise<UserProgressRecord> {
    try {
      logger.info({ progressId: id }, 'Updating user progress');
      
      await db
        .update(userModuleProgress)
        .set({
          data: sql`${userModuleProgress.data} || ${JSON.stringify(progressData)}`,
          updatedAt: new Date(),
        })
        .where(eq(userModuleProgress.id, id));

      const result = await db
        .select()
        .from(userModuleProgress)
        .where(eq(userModuleProgress.id, id))
        .limit(1);

      const updatedProgress = result[0];
      if (!updatedProgress) {
        throw new Error('User progress not found after update');
      }

      logger.info({ progressId: id }, 'User progress updated successfully');
      
      return {
        id: updatedProgress.id,
        data: updatedProgress.data as UserModuleProgressData,
        createdAt: updatedProgress.createdAt,
        updatedAt: updatedProgress.updatedAt,
      };
    } catch (error) {
      logger.error({ error, progressId: id }, 'Error updating user progress');
      throw error;
    }
  }

  async function getUserProgressList(userId: string, options: UserProgressQuery): Promise<UserProgressRecord[]> {
    try {
      logger.debug({ userId, options }, 'Finding user progress list');
      
      let whereConditions = [
        eq(sql`${userModuleProgress.data}->>'userId'`, userId)
      ];
      
      if (options.status) {
        whereConditions.push(
          eq(sql`${userModuleProgress.data}->'progress'->>'status'`, options.status)
        );
      }

      const result = await db
        .select()
        .from(userModuleProgress)
        .where(and(...whereConditions))
        .orderBy(sql`${userModuleProgress.updatedAt} DESC`);

      const progressList = result.map(progress => ({
        id: progress.id,
        data: progress.data as UserModuleProgressData,
        createdAt: progress.createdAt,
        updatedAt: progress.updatedAt,
      }));

      logger.info({ 
        userId, 
        foundProgress: progressList.length 
      }, 'User progress list retrieved successfully');

      return progressList;
    } catch (error) {
      logger.error({ error, userId, options }, 'Error finding user progress list');
      throw error;
    }
  }

  async function deleteUserProgress(id: string): Promise<void> {
    try {
      logger.info({ progressId: id }, 'Deleting user progress');
      
      await db
        .delete(userModuleProgress)
        .where(eq(userModuleProgress.id, id));

      logger.info({ progressId: id }, 'User progress deleted successfully');
    } catch (error) {
      logger.error({ error, progressId: id }, 'Error deleting user progress');
      throw error;
    }
  }

  // Analytics methods
  async function getModuleStats(moduleId: string) {
    try {
      logger.debug({ moduleId }, 'Getting module statistics');
      
      const result = await db
        .select({
          totalUsers: sql<number>`count(*)`,
          completedUsers: sql<number>`count(*) filter (where ${userModuleProgress.data}->'progress'->>'status' = 'completed')`,
          averageProgress: sql<number>`avg((${userModuleProgress.data}->'progress'->>'completionPercentage')::numeric)`,
          averageTimeSpent: sql<number>`avg((${userModuleProgress.data}->'progress'->>'timeSpent')::numeric)`,
        })
        .from(userModuleProgress)
        .where(eq(sql`${userModuleProgress.data}->>'moduleId'`, moduleId));

      const stats = result[0];
      
      return {
        totalUsers: Number(stats?.totalUsers) || 0,
        completedUsers: Number(stats?.completedUsers) || 0,
        averageProgress: Number(stats?.averageProgress) || 0,
        averageTimeSpent: Number(stats?.averageTimeSpent) || 0,
      };
    } catch (error) {
      logger.error({ error, moduleId }, 'Error getting module statistics');
      throw error;
    }
  }

  async function getUserStats(userId: string) {
    try {
      logger.debug({ userId }, 'Getting user statistics');
      
      const result = await db
        .select({
          totalModules: sql<number>`count(*)`,
          completedModules: sql<number>`count(*) filter (where ${userModuleProgress.data}->'progress'->>'status' = 'completed')`,
          inProgressModules: sql<number>`count(*) filter (where ${userModuleProgress.data}->'progress'->>'status' = 'in_progress')`,
          totalTimeSpent: sql<number>`sum((${userModuleProgress.data}->'progress'->>'timeSpent')::numeric)`,
        })
        .from(userModuleProgress)
        .where(eq(sql`${userModuleProgress.data}->>'userId'`, userId));

      const stats = result[0];
      
      return {
        totalModules: Number(stats?.totalModules) || 0,
        completedModules: Number(stats?.completedModules) || 0,
        inProgressModules: Number(stats?.inProgressModules) || 0,
        totalTimeSpent: Number(stats?.totalTimeSpent) || 0,
      };
    } catch (error) {
      logger.error({ error, userId }, 'Error getting user statistics');
      throw error;
    }
  }

  return {
    createModule,
    getModuleById,
    getModules,
    updateModule,
    deleteModule,
    createUserProgress,
    getUserProgress,
    updateUserProgress,
    getUserProgressList,
    deleteUserProgress,
    getModuleStats,
    getUserStats,
  };
} 