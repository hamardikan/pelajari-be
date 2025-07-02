import { eq, and, sql, desc } from 'drizzle-orm';
import type { Database } from '../config/database.js';
import type { Logger } from 'pino';
import { roleplayScenarios, roleplaySessions } from '../db/schema.js';
import type { RoleplayScenarioData, RoleplaySessionData } from '../db/schema.js';

export type RoleplayScenarioRecord = {
  id: string;
  data: RoleplayScenarioData;
  createdAt: Date;
  updatedAt: Date;
};

export type RoleplaySessionRecord = {
  id: string;
  data: RoleplaySessionData;
  createdAt: Date;
  updatedAt: Date;
};

export type ScenariosQuery = {
  page: number;
  limit: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  search?: string;
  competency?: string;
};

export type UserSessionsQuery = {
  page: number;
  limit: number;
  status?: 'active' | 'completed' | 'abandoned';
  scenarioId?: string;
};

export type RoleplayRepository = {
  // Scenario management
  createScenario: (scenarioData: RoleplayScenarioData) => Promise<RoleplayScenarioRecord>;
  getScenarioById: (id: string) => Promise<RoleplayScenarioRecord | null>;
  getPublishedScenarios: (options: ScenariosQuery) => Promise<{
    scenarios: RoleplayScenarioRecord[];
    total: number;
    page: number;
    limit: number;
  }>;
  updateScenario: (id: string, scenarioData: Partial<RoleplayScenarioData>) => Promise<RoleplayScenarioRecord>;
  deleteScenario: (id: string) => Promise<void>;
  incrementScenarioUsage: (id: string) => Promise<void>;
  updateScenarioStats: (id: string, newScore: number) => Promise<void>;
  
  // Session management
  createSession: (sessionData: RoleplaySessionData) => Promise<RoleplaySessionRecord>;
  getSessionById: (id: string) => Promise<RoleplaySessionRecord | null>;
  updateSession: (id: string, sessionData: Partial<RoleplaySessionData>) => Promise<RoleplaySessionRecord>;
  getUserSessions: (userId: string, options: UserSessionsQuery) => Promise<{
    sessions: RoleplaySessionRecord[];
    total: number;
    page: number;
    limit: number;
  }>;
  getActiveUserSession: (userId: string) => Promise<RoleplaySessionRecord | null>;
  getSessionsByScenario: (scenarioId: string) => Promise<RoleplaySessionRecord[]>;
  
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

export function createRoleplayRepository(db: Database, logger: Logger): RoleplayRepository {
  
  // Scenario management methods
  async function createScenario(scenarioData: RoleplayScenarioData): Promise<RoleplayScenarioRecord> {
    try {
      logger.info({ title: scenarioData.title }, 'Creating roleplay scenario');
      
      const result = await db
        .insert(roleplayScenarios)
        .values({ data: scenarioData })
        .returning();

      const newScenario = result[0];
      if (!newScenario) {
        throw new Error('Failed to create roleplay scenario - no result returned');
      }
      
      logger.info({ scenarioId: newScenario.id, title: scenarioData.title }, 'Roleplay scenario created successfully');

      return {
        id: newScenario.id,
        data: newScenario.data as RoleplayScenarioData,
        createdAt: newScenario.createdAt,
        updatedAt: newScenario.updatedAt,
      };
    } catch (error) {
      logger.error({ error, title: scenarioData.title }, 'Error creating roleplay scenario');
      throw error;
    }
  }

  async function getScenarioById(id: string): Promise<RoleplayScenarioRecord | null> {
    try {
      logger.debug({ scenarioId: id }, 'Finding roleplay scenario by ID');
      
      const result = await db
        .select()
        .from(roleplayScenarios)
        .where(eq(roleplayScenarios.id, id))
        .limit(1);

      if (result.length === 0) {
        logger.debug({ scenarioId: id }, 'Roleplay scenario not found by ID');
        return null;
      }

      const scenario = result[0];
      if (!scenario) {
        return null;
      }
      
      return {
        id: scenario.id,
        data: scenario.data as RoleplayScenarioData,
        createdAt: scenario.createdAt,
        updatedAt: scenario.updatedAt,
      };
    } catch (error) {
      logger.error({ error, scenarioId: id }, 'Error finding roleplay scenario by ID');
      throw error;
    }
  }

  async function getPublishedScenarios(options: ScenariosQuery) {
    try {
      logger.debug({ options }, 'Finding published roleplay scenarios');
      
      const offset = (options.page - 1) * options.limit;
      let whereConditions = [
        eq(sql`${roleplayScenarios.data}->>'isPublished'`, 'true')
      ];
      
      if (options.search) {
        whereConditions.push(
          sql`(${roleplayScenarios.data}->>'title' ILIKE ${`%${options.search}%`} OR ${roleplayScenarios.data}->>'description' ILIKE ${`%${options.search}%`})`
        );
      }
      
      if (options.difficulty) {
        whereConditions.push(
          eq(sql`${roleplayScenarios.data}->>'difficulty'`, options.difficulty)
        );
      }
      
      if (options.competency) {
        whereConditions.push(
          sql`${roleplayScenarios.data}->'targetCompetencies' ? ${options.competency}`
        );
      }

      const whereClause = and(...whereConditions);

      const [scenariosResult, countResult] = await Promise.all([
        db
          .select()
          .from(roleplayScenarios)
          .where(whereClause)
          .limit(options.limit)
          .offset(offset)
          .orderBy(desc(roleplayScenarios.createdAt)),
        db
          .select({ count: sql<number>`count(*)` })
          .from(roleplayScenarios)
          .where(whereClause)
      ]);

      const scenarios = scenariosResult.map(scenario => ({
        id: scenario.id,
        data: scenario.data as RoleplayScenarioData,
        createdAt: scenario.createdAt,
        updatedAt: scenario.updatedAt,
      }));

      const total = Number(countResult[0]?.count) || 0;

      logger.info({ 
        foundScenarios: scenarios.length, 
        total, 
        page: options.page, 
        limit: options.limit 
      }, 'Published roleplay scenarios retrieved successfully');

      return {
        scenarios,
        total,
        page: options.page,
        limit: options.limit,
      };
    } catch (error) {
      logger.error({ error, options }, 'Error finding published roleplay scenarios');
      throw error;
    }
  }

  async function updateScenario(id: string, scenarioData: Partial<RoleplayScenarioData>): Promise<RoleplayScenarioRecord> {
    try {
      logger.info({ scenarioId: id }, 'Updating roleplay scenario');
      
      await db
        .update(roleplayScenarios)
        .set({
          data: sql`${roleplayScenarios.data} || ${JSON.stringify(scenarioData)}`,
          updatedAt: new Date(),
        })
        .where(eq(roleplayScenarios.id, id));

      const updatedScenario = await getScenarioById(id);
      if (!updatedScenario) {
        throw new Error('Roleplay scenario not found after update');
      }

      logger.info({ scenarioId: id }, 'Roleplay scenario updated successfully');
      return updatedScenario;
    } catch (error) {
      logger.error({ error, scenarioId: id }, 'Error updating roleplay scenario');
      throw error;
    }
  }

  async function deleteScenario(id: string): Promise<void> {
    try {
      logger.info({ scenarioId: id }, 'Deleting roleplay scenario');
      
      await db
        .delete(roleplayScenarios)
        .where(eq(roleplayScenarios.id, id));

      logger.info({ scenarioId: id }, 'Roleplay scenario deleted successfully');
    } catch (error) {
      logger.error({ error, scenarioId: id }, 'Error deleting roleplay scenario');
      throw error;
    }
  }

  async function incrementScenarioUsage(id: string): Promise<void> {
    try {
      logger.debug({ scenarioId: id }, 'Incrementing scenario usage count');
      
      await db
        .update(roleplayScenarios)
        .set({
          data: sql`jsonb_set(${roleplayScenarios.data}, '{usage,timesUsed}', (COALESCE((${roleplayScenarios.data}->'usage'->>'timesUsed')::int, 0) + 1)::text::jsonb)`,
          updatedAt: new Date(),
        })
        .where(eq(roleplayScenarios.id, id));

      logger.debug({ scenarioId: id }, 'Scenario usage count incremented');
    } catch (error) {
      logger.error({ error, scenarioId: id }, 'Error incrementing scenario usage');
      throw error;
    }
  }

  async function updateScenarioStats(id: string, newScore: number): Promise<void> {
    try {
      logger.debug({ scenarioId: id, newScore }, 'Updating scenario average score');
      
      // Get current stats
      const scenario = await getScenarioById(id);
      if (!scenario) {
        throw new Error('Scenario not found');
      }

      const currentAverage = scenario.data.usage.averageScore || 0;
      const timesUsed = scenario.data.usage.timesUsed || 1;
      const newAverage = ((currentAverage * (timesUsed - 1)) + newScore) / timesUsed;

      await db
        .update(roleplayScenarios)
        .set({
          data: sql`jsonb_set(${roleplayScenarios.data}, '{usage,averageScore}', ${newAverage}::text::jsonb)`,
          updatedAt: new Date(),
        })
        .where(eq(roleplayScenarios.id, id));

      logger.debug({ scenarioId: id, newAverage }, 'Scenario average score updated');
    } catch (error) {
      logger.error({ error, scenarioId: id, newScore }, 'Error updating scenario stats');
      throw error;
    }
  }

  // Session management methods
  async function createSession(sessionData: RoleplaySessionData): Promise<RoleplaySessionRecord> {
    try {
      logger.info({ 
        userId: sessionData.userId, 
        scenarioId: sessionData.scenarioId 
      }, 'Creating roleplay session');
      
      const result = await db
        .insert(roleplaySessions)
        .values({ data: sessionData })
        .returning();

      const newSession = result[0];
      if (!newSession) {
        throw new Error('Failed to create roleplay session - no result returned');
      }
      
      logger.info({ 
        sessionId: newSession.id,
        userId: sessionData.userId, 
        scenarioId: sessionData.scenarioId 
      }, 'Roleplay session created successfully');

      return {
        id: newSession.id,
        data: newSession.data as RoleplaySessionData,
        createdAt: newSession.createdAt,
        updatedAt: newSession.updatedAt,
      };
    } catch (error) {
      logger.error({ 
        error, 
        userId: sessionData.userId, 
        scenarioId: sessionData.scenarioId 
      }, 'Error creating roleplay session');
      throw error;
    }
  }

  async function getSessionById(id: string): Promise<RoleplaySessionRecord | null> {
    try {
      logger.debug({ sessionId: id }, 'Finding roleplay session by ID');
      
      const result = await db
        .select()
        .from(roleplaySessions)
        .where(eq(roleplaySessions.id, id))
        .limit(1);

      if (result.length === 0) {
        logger.debug({ sessionId: id }, 'Roleplay session not found by ID');
        return null;
      }

      const session = result[0];
      if (!session) {
        return null;
      }
      
      return {
        id: session.id,
        data: session.data as RoleplaySessionData,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      };
    } catch (error) {
      logger.error({ error, sessionId: id }, 'Error finding roleplay session by ID');
      throw error;
    }
  }

  async function updateSession(id: string, sessionData: Partial<RoleplaySessionData>): Promise<RoleplaySessionRecord> {
    try {
      logger.debug({ sessionId: id }, 'Updating roleplay session');
      
      await db
        .update(roleplaySessions)
        .set({
          data: sql`${roleplaySessions.data} || ${JSON.stringify(sessionData)}`,
          updatedAt: new Date(),
        })
        .where(eq(roleplaySessions.id, id));

      const updatedSession = await getSessionById(id);
      if (!updatedSession) {
        throw new Error('Roleplay session not found after update');
      }

      logger.debug({ sessionId: id }, 'Roleplay session updated successfully');
      return updatedSession;
    } catch (error) {
      logger.error({ error, sessionId: id }, 'Error updating roleplay session');
      throw error;
    }
  }

  async function getUserSessions(userId: string, options: UserSessionsQuery) {
    try {
      logger.debug({ userId, options }, 'Finding user roleplay sessions');
      
      const offset = (options.page - 1) * options.limit;
      let whereConditions = [
        eq(sql`${roleplaySessions.data}->>'userId'`, userId)
      ];
      
      if (options.status) {
        whereConditions.push(
          eq(sql`${roleplaySessions.data}->'sessionData'->>'status'`, options.status)
        );
      }
      
      if (options.scenarioId) {
        whereConditions.push(
          eq(sql`${roleplaySessions.data}->>'scenarioId'`, options.scenarioId)
        );
      }

      const whereClause = and(...whereConditions);

      const [sessionsResult, countResult] = await Promise.all([
        db
          .select()
          .from(roleplaySessions)
          .where(whereClause)
          .limit(options.limit)
          .offset(offset)
          .orderBy(desc(roleplaySessions.createdAt)),
        db
          .select({ count: sql<number>`count(*)` })
          .from(roleplaySessions)
          .where(whereClause)
      ]);

      const sessions = sessionsResult.map(session => ({
        id: session.id,
        data: session.data as RoleplaySessionData,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      }));

      const total = Number(countResult[0]?.count) || 0;

      logger.info({ 
        userId,
        foundSessions: sessions.length, 
        total, 
        page: options.page, 
        limit: options.limit 
      }, 'User roleplay sessions retrieved successfully');

      return {
        sessions,
        total,
        page: options.page,
        limit: options.limit,
      };
    } catch (error) {
      logger.error({ error, userId, options }, 'Error finding user roleplay sessions');
      throw error;
    }
  }

  async function getActiveUserSession(userId: string): Promise<RoleplaySessionRecord | null> {
    try {
      logger.debug({ userId }, 'Finding active roleplay session for user');
      
      const result = await db
        .select()
        .from(roleplaySessions)
        .where(
          and(
            eq(sql`${roleplaySessions.data}->>'userId'`, userId),
            eq(sql`${roleplaySessions.data}->'sessionData'->>'status'`, 'active')
          )
        )
        .limit(1);

      if (result.length === 0) {
        logger.debug({ userId }, 'No active roleplay session found for user');
        return null;
      }

      const session = result[0];
      if (!session) {
        return null;
      }
      
      return {
        id: session.id,
        data: session.data as RoleplaySessionData,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      };
    } catch (error) {
      logger.error({ error, userId }, 'Error finding active roleplay session for user');
      throw error;
    }
  }

  async function getSessionsByScenario(scenarioId: string): Promise<RoleplaySessionRecord[]> {
    try {
      logger.debug({ scenarioId }, 'Finding sessions by scenario');
      
      const result = await db
        .select()
        .from(roleplaySessions)
        .where(eq(sql`${roleplaySessions.data}->>'scenarioId'`, scenarioId))
        .orderBy(desc(roleplaySessions.createdAt));

      const sessions = result.map(session => ({
        id: session.id,
        data: session.data as RoleplaySessionData,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      }));

      logger.info({ 
        scenarioId,
        foundSessions: sessions.length 
      }, 'Sessions by scenario retrieved successfully');

      return sessions;
    } catch (error) {
      logger.error({ error, scenarioId }, 'Error finding sessions by scenario');
      throw error;
    }
  }

  // Analytics methods
  async function getScenarioStats(scenarioId: string) {
    try {
      logger.debug({ scenarioId }, 'Getting scenario statistics');
      
      const result = await db
        .select({
          totalSessions: sql<number>`count(*)`,
          completedSessions: sql<number>`count(*) filter (where ${roleplaySessions.data}->'sessionData'->>'status' = 'completed')`,
          averageScore: sql<number>`avg((${roleplaySessions.data}->'sessionData'->'evaluation'->>'overallScore')::numeric)`,
          averageDuration: sql<number>`avg((${roleplaySessions.data}->'sessionData'->>'totalDuration')::numeric)`,
        })
        .from(roleplaySessions)
        .where(eq(sql`${roleplaySessions.data}->>'scenarioId'`, scenarioId));

      const stats = result[0];
      
      return {
        totalSessions: Number(stats?.totalSessions) || 0,
        completedSessions: Number(stats?.completedSessions) || 0,
        averageScore: Number(stats?.averageScore) || 0,
        averageDuration: Number(stats?.averageDuration) || 0,
      };
    } catch (error) {
      logger.error({ error, scenarioId }, 'Error getting scenario statistics');
      throw error;
    }
  }

  async function getUserRoleplayStats(userId: string) {
    try {
      logger.debug({ userId }, 'Getting user roleplay statistics');
      
      const result = await db
        .select({
          totalSessions: sql<number>`count(*)`,
          completedSessions: sql<number>`count(*) filter (where ${roleplaySessions.data}->'sessionData'->>'status' = 'completed')`,
          averageScore: sql<number>`avg((${roleplaySessions.data}->'sessionData'->'evaluation'->>'overallScore')::numeric)`,
          totalTimeSpent: sql<number>`sum((${roleplaySessions.data}->'sessionData'->>'totalDuration')::numeric)`,
        })
        .from(roleplaySessions)
        .where(eq(sql`${roleplaySessions.data}->>'userId'`, userId));

      const stats = result[0];
      
      return {
        totalSessions: Number(stats?.totalSessions) || 0,
        completedSessions: Number(stats?.completedSessions) || 0,
        averageScore: Number(stats?.averageScore) || 0,
        totalTimeSpent: Number(stats?.totalTimeSpent) || 0,
      };
    } catch (error) {
      logger.error({ error, userId }, 'Error getting user roleplay statistics');
      throw error;
    }
  }

  return {
    // Scenario management
    createScenario,
    getScenarioById,
    getPublishedScenarios,
    updateScenario,
    deleteScenario,
    incrementScenarioUsage,
    updateScenarioStats,
    
    // Session management
    createSession,
    getSessionById,
    updateSession,
    getUserSessions,
    getActiveUserSession,
    getSessionsByScenario,
    
    // Analytics
    getScenarioStats,
    getUserRoleplayStats,
  };
} 