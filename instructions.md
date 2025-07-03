# Roleplay Feature Implementation Guide

## Overview
This document provides comprehensive implementation instructions for adding the roleplay feature to the Pelajari platform. The feature allows users to engage in AI-powered roleplay scenarios for skill development with real-time chat and performance evaluation.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   AI Worker     │
│                 │    │                 │    │                 │
│  Socket.IO      │◄──►│  Socket.IO      │◄──►│  OpenRouter     │
│  HTTP Requests  │◄──►│  Express Routes │    │  GPT Model      │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       │   Database      │
                       └─────────────────┘
```

## Phase 1: Database Seed Data

### File: `src/roleplay/seed-scenarios.ts`
Create initial roleplay scenarios for the database.

```typescript
import type { RoleplayScenarioData } from '../db/schema.js';

export const defaultRoleplayScenarios: Omit<RoleplayScenarioData, 'authorId'>[] = [
  {
    title: "Handling a Difficult Client",
    description: "Practice managing challenging customer interactions and conflict resolution skills",
    difficulty: 'intermediate',
    estimatedDuration: 15,
    targetCompetencies: ['communication', 'empathy', 'problem-solving', 'patience'],
    scenario: {
      context: "You are a customer service representative at a software company. A client has been experiencing technical issues for the past week and is frustrated that previous support attempts haven't resolved their problem.",
      setting: "Phone call during business hours",
      yourRole: "Senior Customer Service Representative",
      aiRole: "Frustrated Client (Alex Thompson)",
      objectives: [
        "Acknowledge the client's frustration and show empathy",
        "Gather detailed information about the technical issue",
        "Provide a clear action plan with timeline",
        "Restore client confidence in your company's service"
      ],
      successCriteria: [
        "Client feels heard and understood",
        "Technical issue details are properly documented",
        "Clear next steps are communicated",
        "Professional tone maintained throughout"
      ]
    },
    systemPrompt: `You are Alex Thompson, a frustrated client who has been experiencing technical issues with software for a week. You run a small business and this software is critical for your daily operations. You've contacted support twice before but the issues weren't resolved.

CHARACTER TRAITS:
- Initially frustrated and impatient
- Concerned about business impact
- Willing to cooperate if you feel heard
- Appreciates clear communication and action plans
- Becomes more reasonable when treated with empathy

CONVERSATION STYLE:
- Start somewhat agitated but not abusive
- Express specific concerns about business impact
- Ask pointed questions about resolution timeline
- Respond positively to empathy and clear action plans
- Provide technical details when asked properly

TECHNICAL ISSUE:
- Software crashes when generating monthly reports
- Error message: "Database connection timeout"
- Happens consistently for the past 7 days
- Critical for month-end business processes

Remember: You're frustrated but professional. Respond naturally to the customer service representative's approach.`,
    evaluationCriteria: {
      communicationSkills: [
        "Active listening and acknowledgment",
        "Clear and professional language",
        "Appropriate tone management",
        "Effective questioning techniques"
      ],
      problemSolving: [
        "Systematic information gathering",
        "Root cause identification",
        "Solution-oriented approach",
        "Follow-up planning"
      ],
      customerService: [
        "Empathy demonstration",
        "Patience under pressure",
        "Service recovery skills",
        "Relationship building"
      ]
    },
    tags: ['customer-service', 'conflict-resolution', 'communication'],
    isPublished: true,
    usage: {
      timesUsed: 0,
      averageScore: 0
    }
  },
  {
    title: "Performance Review Conversation",
    description: "Learn to conduct effective performance reviews with direct reports",
    difficulty: 'advanced',
    estimatedDuration: 20,
    targetCompetencies: ['leadership', 'feedback-delivery', 'coaching', 'goal-setting'],
    scenario: {
      context: "You are conducting a quarterly performance review with one of your team members. They have been meeting basic expectations but haven't shown initiative for growth opportunities. You need to provide constructive feedback and set development goals.",
      setting: "Private office meeting",
      yourRole: "Team Manager",
      aiRole: "Team Member (Jordan Kim)",
      objectives: [
        "Provide balanced feedback on current performance",
        "Identify areas for improvement and growth",
        "Set specific, measurable goals for next quarter",
        "Motivate and engage the employee for better performance"
      ],
      successCriteria: [
        "Clear performance feedback delivered constructively",
        "Specific development areas identified",
        "SMART goals established collaboratively",
        "Employee feels supported and motivated"
      ]
    },
    systemPrompt: `You are Jordan Kim, a mid-level employee who has been with the company for 2 years. You do your assigned work competently but haven't sought out additional responsibilities or shown much initiative. You're generally satisfied with your role but haven't thought much about career development.

CHARACTER TRAITS:
- Competent but not proactive
- Generally positive attitude
- Somewhat comfortable in current role
- Open to feedback but may need encouragement
- Values work-life balance
- Sometimes lacks confidence in taking on new challenges

CONVERSATION STYLE:
- Polite and respectful
- May be initially defensive about feedback
- Appreciates specific examples
- Responds well to encouragement and support
- Asks clarifying questions when goals are unclear
- Shows enthusiasm when given clear direction

PERFORMANCE CONTEXT:
- Meets deadlines and quality standards
- Good team collaboration
- Limited initiative on process improvements
- Hasn't volunteered for stretch assignments
- Strong technical skills but needs leadership development

Remember: You're professional and willing to improve, but may need guidance to see growth opportunities.`,
    evaluationCriteria: {
      leadership: [
        "Clear goal setting and expectations",
        "Motivational communication",
        "Development planning",
        "Performance coaching"
      ],
      communication: [
        "Balanced feedback delivery",
        "Active listening skills",
        "Constructive conversation management",
        "Follow-up planning"
      ],
      management: [
        "Performance assessment accuracy",
        "Development opportunity identification",
        "SMART goal creation",
        "Employee engagement"
      ]
    },
    tags: ['leadership', 'management', 'performance-review', 'coaching'],
    isPublished: true,
    usage: {
      timesUsed: 0,
      averageScore: 0
    }
  },
  {
    title: "Project Conflict Resolution",
    description: "Navigate team conflicts and find collaborative solutions in project settings",
    difficulty: 'intermediate',
    estimatedDuration: 18,
    targetCompetencies: ['conflict-resolution', 'negotiation', 'team-collaboration', 'project-management'],
    scenario: {
      context: "You are leading a cross-functional project team. Two key team members from different departments have a disagreement about the project approach that's causing delays. You need to mediate and find a solution that moves the project forward.",
      setting: "Project team meeting room",
      yourRole: "Project Manager",
      aiRole: "Team Member (Sam Martinez from Marketing)",
      objectives: [
        "Understand both perspectives on the conflict",
        "Identify common ground and shared goals",
        "Facilitate collaborative problem-solving",
        "Establish a path forward that satisfies key requirements"
      ],
      successCriteria: [
        "All viewpoints are heard and acknowledged",
        "Root causes of disagreement identified",
        "Collaborative solution developed",
        "Clear action plan with ownership established"
      ]
    },
    systemPrompt: `You are Sam Martinez from the Marketing department, working on a cross-functional project to launch a new product feature. You strongly believe the project should prioritize user experience and market research insights, but you're in conflict with the Engineering team member who wants to focus on technical feasibility and quick delivery.

CHARACTER TRAITS:
- Passionate about user-centered design
- Data-driven in decision making
- Sometimes impatient with technical constraints
- Collaborative when your expertise is valued
- Protective of marketing timeline and budget

CONVERSATION STYLE:
- Present clear rationale for your position
- Use market research and user data to support arguments
- Express concern about rushing to market without proper validation
- Willing to compromise if core user experience isn't sacrificed
- Appreciate when technical constraints are explained clearly

YOUR POSITION:
- Believe thorough user testing is essential before launch
- Concerned that engineering approach will hurt user adoption
- Have market research showing importance of specific features
- Under pressure from marketing leadership for successful launch
- Want to ensure brand reputation isn't damaged

CONFLICT POINTS:
- Timeline disagreements (you want more time for testing)
- Feature priorities (UX vs technical implementation)
- Resource allocation between research and development
- Risk tolerance for launching with minimal validation

Remember: You're professional and want project success, but strongly advocate for the marketing perspective.`,
    evaluationCriteria: {
      conflictResolution: [
        "Neutral facilitation approach",
        "Understanding of all perspectives",
        "Creative problem-solving",
        "Win-win solution development"
      ],
      communication: [
        "Active listening demonstration",
        "Clear mediation skills",
        "Diplomatic language use",
        "Effective questioning"
      ],
      projectManagement: [
        "Stakeholder management",
        "Decision-making facilitation",
        "Risk assessment and mitigation",
        "Timeline and resource balancing"
      ]
    },
    tags: ['project-management', 'conflict-resolution', 'team-leadership', 'negotiation'],
    isPublished: true,
    usage: {
      timesUsed: 0,
      averageScore: 0
    }
  }
];
```

### File: `src/roleplay/seed.ts`
Database seeding utility.

```typescript
import type { Database } from '../config/database.js';
import type { Logger } from 'pino';
import { roleplayScenarios } from '../db/schema.js';
import { defaultRoleplayScenarios } from './seed-scenarios.js';

export async function seedRoleplayScenarios(db: Database, logger: Logger): Promise<void> {
  try {
    logger.info('Starting roleplay scenarios seeding...');

    for (const scenarioData of defaultRoleplayScenarios) {
      const scenarioWithAuthor = {
        ...scenarioData,
        authorId: 'system', // System-created scenarios
      };

      await db.insert(roleplayScenarios).values({
        data: scenarioWithAuthor,
      });

      logger.info({ title: scenarioData.title }, 'Seeded roleplay scenario');
    }

    logger.info({ count: defaultRoleplayScenarios.length }, 'Roleplay scenarios seeding completed');
  } catch (error) {
    logger.error({ error }, 'Failed to seed roleplay scenarios');
    throw error;
  }
}
```

## Phase 2: Repository Layer

### File: `src/roleplay/roleplay.repositories.ts`

```typescript
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
          completedSessions: sql<number>`count(*) filter (where ${roleplaySessions.data}->'sessionData'->>'
```typescript
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
```

## Phase 3: Service Layer

### File: `src/roleplay/roleplay.services.ts`

```typescript
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
```

## Phase 4: Handler Layer

### File: `src/roleplay/roleplay.handlers.ts`

```typescript
import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import type { RoleplayService } from './roleplay.services.js';
import type { RequestWithCorrelation } from '../config/logger.js';
import { createAsyncErrorWrapper } from '../shared/middleware/error.middleware.js';

export type RoleplayHandlerDependencies = {
  roleplayService: RoleplayService;
  logger: Logger;
};

export type RoleplayHandlers = {
  // Scenario endpoints
  getScenarios: (req: Request, res: Response, next: NextFunction) => void;
  getScenarioDetails: (req: Request, res: Response, next: NextFunction) => void;
  
  // Session management endpoints
  startSession: (req: Request, res: Response, next: NextFunction) => void;
  sendMessage: (req: Request, res: Response, next: NextFunction) => void;
  endSession: (req: Request, res: Response, next: NextFunction) => void;
  
  // Session retrieval endpoints
  getSessionDetails: (req: Request, res: Response, next: NextFunction) => void;
  getUserSessions: (req: Request, res: Response, next: NextFunction) => void;
  getSessionTranscript: (req: Request, res: Response, next: NextFunction) => void;
  
  // Analytics endpoints
  getScenarioStats: (req: Request, res: Response, next: NextFunction) => void;
  getUserStats: (req: Request, res: Response, next: NextFunction) => void;
};

function createRoleplayHandlers(dependencies: RoleplayHandlerDependencies): RoleplayHandlers {
  const { roleplayService, logger } = dependencies;

  async function getScenarios(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const options = req.query as any; // Should be validated by middleware

      logger.debug({ correlationId, options }, 'Fetching available roleplay scenarios');
      
      const result = await roleplayService.getAvailableScenarios(options);
      
      logger.info({ 
        correlationId, 
        scenariosCount: result.scenarios.length,
        total: result.total 
      }, 'Roleplay scenarios retrieved successfully');
      
      res.json({
        success: true,
        message: 'Roleplay scenarios retrieved successfully',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to retrieve roleplay scenarios');
      next(error);
    }
  }

  async function getScenarioDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const { scenarioId } = req.params;

      logger.debug({ correlationId, scenarioId }, 'Fetching roleplay scenario details');
      
      const scenario = await roleplayService.getScenarioDetails(scenarioId);
      
      logger.info({ correlationId, scenarioId }, 'Roleplay scenario details retrieved successfully');
      
      res.json({
        success: true,
        message: 'Scenario details retrieved successfully',
        data: { scenario },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        scenarioId: req.params.scenarioId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to retrieve scenario details');
      next(error);
    }
  }

  async function startSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      // For now, we'll use a dummy user ID. In production, this would come from authentication
      const userId = 'user-123'; // TODO: Get from authentication middleware
      const { scenarioId } = req.params;

      logger.info({ correlationId, userId, scenarioId }, 'Starting roleplay session');
      
      const result = await roleplayService.startRoleplaySession(userId, scenarioId);
      
      logger.info({ 
        correlationId, 
        userId, 
        sessionId: result.sessionId,
        scenarioId 
      }, 'Roleplay session started successfully');
      
      res.status(201).json({
        success: true,
        message: 'Roleplay session started successfully',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        scenarioId: req.params.scenarioId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to start roleplay session');
      next(error);
    }
  }

  async function sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      // For now, we'll use a dummy user ID. In production, this would come from authentication
      const userId = 'user-123'; // TODO: Get from authentication middleware
      const { sessionId } = req.params;
      const { message } = req.body; // Should be validated by middleware

      logger.info({ correlationId, userId, sessionId }, 'Processing roleplay message');
      
      const result = await roleplayService.sendMessage(sessionId, userId, message);
      
      logger.info({ 
        correlationId, 
        userId, 
        sessionId,
        messageId: result.messageId 
      }, 'Roleplay message processed successfully');
      
      res.json({
        success: true,
        message: 'Message sent successfully',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to process roleplay message');
      next(error);
    }
  }

  async function endSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      // For now, we'll use a dummy user ID. In production, this would come from authentication
      const userId = 'user-123'; // TODO: Get from authentication middleware
      const { sessionId } = req.params;

      logger.info({ correlationId, userId, sessionId }, 'Ending roleplay session');
      
      const result = await roleplayService.endSession(sessionId, userId);
      
      logger.info({ 
        correlationId, 
        userId, 
        sessionId,
        overallScore: result.evaluation.overallScore 
      }, 'Roleplay session ended successfully');
      
      res.json({
        success: true,
        message: 'Session ended successfully',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to end roleplay session');
      next(error);
    }
  }

  async function getSessionDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      // For now, we'll use a dummy user ID. In production, this would come from authentication
      const userId = 'user-123'; // TODO: Get from authentication middleware
      const { sessionId } = req.params;

      logger.debug({ correlationId, userId, sessionId }, 'Fetching roleplay session details');
      
      const session = await roleplayService.getSessionDetails(sessionId, userId);
      
      logger.info({ correlationId, userId, sessionId }, 'Session details retrieved successfully');
      
      res.json({
        success: true,
        message: 'Session details retrieved successfully',
        data: { session },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to retrieve session details');
      next(error);
    }
  }

  async function getUserSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      // For now, we'll use a dummy user ID. In production, this would come from authentication
      const userId = 'user-123'; // TODO: Get from authentication middleware
      const options = req.query as any; // Should be validated by middleware

      logger.debug({ correlationId, userId, options }, 'Fetching user roleplay sessions');
      
      const result = await roleplayService.getUserSessionHistory(userId, options);
      
      logger.info({ 
        correlationId, 
        userId,
        sessionsCount: result.sessions.length,
        total: result.total 
      }, 'User sessions retrieved successfully');
      
      res.json({
        success: true,
        message: 'User sessions retrieved successfully',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to retrieve user sessions');
      next(error```typescript
      next(error);
    }
  }

  async function getSessionTranscript(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      // For now, we'll use a dummy user ID. In production, this would come from authentication
      const userId = 'user-123'; // TODO: Get from authentication middleware
      const { sessionId } = req.params;

      logger.debug({ correlationId, userId, sessionId }, 'Fetching roleplay session transcript');
      
      const result = await roleplayService.getSessionTranscript(sessionId, userId);
      
      logger.info({ 
        correlationId, 
        userId, 
        sessionId,
        messageCount: result.messages.length 
      }, 'Session transcript retrieved successfully');
      
      res.json({
        success: true,
        message: 'Session transcript retrieved successfully',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        sessionId: req.params.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to retrieve session transcript');
      next(error);
    }
  }

  async function getScenarioStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const { scenarioId } = req.params;

      logger.debug({ correlationId, scenarioId }, 'Fetching scenario statistics');
      
      const stats = await roleplayService.getScenarioStats(scenarioId);
      
      logger.info({ correlationId, scenarioId }, 'Scenario statistics retrieved successfully');
      
      res.json({
        success: true,
        message: 'Scenario statistics retrieved successfully',
        data: { stats },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        scenarioId: req.params.scenarioId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to retrieve scenario statistics');
      next(error);
    }
  }

  async function getUserStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      // For now, we'll use a dummy user ID. In production, this would come from authentication
      const userId = 'user-123'; // TODO: Get from authentication middleware

      logger.debug({ correlationId, userId }, 'Fetching user roleplay statistics');
      
      const stats = await roleplayService.getUserRoleplayStats(userId);
      
      logger.info({ correlationId, userId }, 'User roleplay statistics retrieved successfully');
      
      res.json({
        success: true,
        message: 'User statistics retrieved successfully',
        data: { stats },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to retrieve user statistics');
      next(error);
    }
  }

  // Return all handlers wrapped with async error handling
  return {
    getScenarios: createAsyncErrorWrapper(getScenarios),
    getScenarioDetails: createAsyncErrorWrapper(getScenarioDetails),
    startSession: createAsyncErrorWrapper(startSession),
    sendMessage: createAsyncErrorWrapper(sendMessage),
    endSession: createAsyncErrorWrapper(endSession),
    getSessionDetails: createAsyncErrorWrapper(getSessionDetails),
    getUserSessions: createAsyncErrorWrapper(getUserSessions),
    getSessionTranscript: createAsyncErrorWrapper(getSessionTranscript),
    getScenarioStats: createAsyncErrorWrapper(getScenarioStats),
    getUserStats: createAsyncErrorWrapper(getUserStats),
  };
}

export { createRoleplayHandlers };
```

## Phase 5: Validation Schemas

### File: `src/roleplay/roleplay.schemas.ts`

```typescript
import { z } from 'zod';

// Parameter schemas
export const scenarioIdParamsSchema = z.object({
  scenarioId: z.string().uuid('Invalid scenario ID'),
});

export const sessionIdParamsSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
});

// Request body schemas
export const sendMessageSchema = z.object({
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message must not exceed 1000 characters')
    .trim(),
});

// Query schemas
export const scenariosQuerySchema = z.object({
  page: z.string().transform(Number).refine(n => n > 0, 'Page must be positive').default('1'),
  limit: z.string().transform(Number).refine(n => n > 0 && n <= 50, 'Limit must be between 1-50').default('10'),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  search: z.string().optional(),
  competency: z.string().optional(),
});

export const userSessionsQuerySchema = z.object({
  page: z.string().transform(Number).refine(n => n > 0, 'Page must be positive').default('1'),
  limit: z.string().transform(Number).refine(n => n > 0 && n <= 50, 'Limit must be between 1-50').default('10'),
  status: z.enum(['active', 'completed', 'abandoned']).optional(),
  scenarioId: z.string().uuid().optional(),
});

// Type exports
export type ScenarioIdParams = z.infer<typeof scenarioIdParamsSchema>;
export type SessionIdParams = z.infer<typeof sessionIdParamsSchema>;
export type SendMessageData = z.infer<typeof sendMessageSchema>;
export type ScenariosQuery = z.infer<typeof scenariosQuerySchema>;
export type UserSessionsQuery = z.infer<typeof userSessionsQuerySchema>;

// Schema collection for easy import
const roleplaySchemas = {
  scenarioIdParams: scenarioIdParamsSchema,
  sessionIdParams: sessionIdParamsSchema,
  sendMessage: sendMessageSchema,
  scenariosQuery: scenariosQuerySchema,
  userSessionsQuery: userSessionsQuerySchema,
};

export {
  roleplaySchemas,
};
```

## Phase 6: Routes

### File: `src/roleplay/roleplay.routes.ts`

```typescript
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
```

## Phase 7: AI Worker Thread

### File: `src/workers/roleplay.worker.ts`

```typescript
import { parentPort, workerData } from 'worker_threads';
import OpenAI from 'openai';
import { createLogger } from '../config/logger.js';
import { getEnvironmentConfig } from '../config/environment.js';
import { withResilience, createResilienceConfig } from '../shared/utils/resilience.js';

// Worker data structures for different roleplay tasks
interface InitialMessageWorkerData {
  type: 'initial-message';
  sessionId: string;
  scenario: any;
  userId: string;
}

interface ConversationWorkerData {
  type: 'conversation';
  sessionId: string;
  scenario: any;
  conversationHistory: Array<{
    id: string;
    timestamp: string;
    sender: 'user' | 'ai';
    content: string;
  }>;
  userId: string;
}

interface EvaluationWorkerData {
  type: 'evaluation';
  sessionId: string;
  scenario: any;
  conversationHistory: Array<{
    id: string;
    timestamp: string;
    sender: 'user' | 'ai';
    content: string;
  }>;
  duration: number;
  userId: string;
}

type WorkerData = InitialMessageWorkerData | ConversationWorkerData | EvaluationWorkerData;

const config = getEnvironmentConfig();
const logger = createLogger(config);

// Create OpenAI client
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: config.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": config.SITE_URL || "http://localhost:3000",
    "X-Title": config.SITE_NAME || "Pelajari App",
  },
});

// Resilience configuration for AI processing
const resilienceConfig = createResilienceConfig({
  retry: {
    retries: 3,
    factor: 1.5,
    minTimeout: 1000,
    maxTimeout: 15000,
    randomize: true,
  },
  circuitBreaker: {
    timeout: 120000, // 2 minutes for roleplay AI processing
    errorThresholdPercentage: 60,
    resetTimeout: 60000,
    minimumHalfOpenRequests: 1,
    name: 'roleplay-ai-processing',
  },
  deadLetterQueue: {
    enabled: false,
    maxRetries: 3,
  },
});

const resilientAIProcessing = withResilience(
  async (messages: any[], temperature: number = 0.7) => {
    logger.info({ taskType: 'roleplay-ai-request' }, 'Sending roleplay request to OpenRouter');
    
    const completion = await openai.chat.completions.create({
      model: "google/gemini-2.5-flash",
      messages,
      temperature,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content returned from OpenRouter');
    }

    return content;
  },
  resilienceConfig,
  logger
);

// Enhanced JSON parsing for evaluation results
function parseAIResponse(content: string): any {
  try {
    return JSON.parse(content);
  } catch (firstError: any) {
    try {
      const cleanedContent = content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      return JSON.parse(cleanedContent);
    } catch (secondError: any) {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('No valid JSON found in response');
      } catch (thirdError: any) {
        logger.error({ 
          content: content.substring(0, 500),
          firstError: firstError && firstError.message ? firstError.message : String(firstError),
        }, 'All JSON parsing attempts failed');
        throw new Error(`Failed to parse AI response: ${firstError && firstError.message ? firstError.message : String(firstError)}`);
      }
    }
  }
}

// Generate initial AI message to welcome user to roleplay
async function processInitialMessage(data: InitialMessageWorkerData) {
  const { scenario } = data;
  
  try {
    logger.info({ 
      sessionId: data.sessionId,
      scenarioTitle: scenario.title 
    }, 'Generating initial roleplay message');

    const messages = [
      {
        role: 'system',
        content: `${scenario.systemPrompt}

SCENARIO CONTEXT: ${scenario.scenario.context}
SETTING: ${scenario.scenario.setting}
YOUR ROLE: ${scenario.aiRole}
USER'S ROLE: ${scenario.scenario.yourRole}

INSTRUCTIONS:
- Generate a natural opening message to start the roleplay
- Stay in character as ${scenario.aiRole}
- Set the scene and context naturally
- Be engaging and invite the user to respond
- Keep the message under 150 words
- Do not break character or mention this is an AI simulation`
      },
      {
        role: 'user',
        content: 'Start the roleplay scenario now. Generate your opening message as the character.'
      }
    ];

    const result = await resilientAIProcessing('initial-message', messages, 0.8);
    
    if (!result.success) {
      throw result.error || new Error('Initial message generation failed');
    }

    logger.info({ 
      sessionId: data.sessionId,
      scenarioTitle: scenario.title 
    }, 'Initial roleplay message generated successfully');

    return {
      initialMessage: result.data.trim()
    };
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionId: data.sessionId 
    }, 'Failed to generate initial roleplay message');
    throw error;
  }
}

// Process ongoing conversation in roleplay
async function processConversation(data: ConversationWorkerData) {
  const { scenario, conversationHistory } = data;
  
  try {
    logger.info({ 
      sessionId: data.sessionId,
      messageCount: conversationHistory.length 
    }, 'Processing roleplay conversation');

    // Build conversation context for AI
    const conversationText = conversationHistory
      .slice(-10) // Keep last 10 messages for context
      .map(msg => `${msg.sender.toUpperCase()}: ${msg.content}`)
      .join('\n');

    const messages = [
      {
        role: 'system',
        content: `${scenario.systemPrompt}

SCENARIO CONTEXT: ${scenario.scenario.context}
SETTING: ${scenario.scenario.setting}
YOUR ROLE: ${scenario.aiRole}
USER'S ROLE: ${scenario.scenario.yourRole}

CONVERSATION SO FAR:
${conversationText}

INSTRUCTIONS:
- Continue the roleplay naturally as ${scenario.aiRole}
- Respond to the user's latest message appropriately
- Stay in character throughout
- Keep responses under 200 words
- Drive the scenario forward meaningfully
- React authentically to what the user says and does`
      },
      {
        role: 'user',
        content: 'Continue the roleplay. Respond to my latest message naturally as the character.'
      }
    ];

    const result = await resilientAIProcessing('conversation', messages, 0.7);
    
    if (!result.success) {
      throw result.error || new Error('Conversation processing failed');
    }

    logger.info({ 
      sessionId: data.sessionId,
      messageCount: conversationHistory.length 
    }, 'Roleplay conversation processed successfully');

    return {
      aiResponse: result.data.trim()
    };
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionId: data.sessionId 
    }, 'Failed to process roleplay conversation');
    throw error;
  }
}

// Generate final evaluation of roleplay session
async function processEvaluation(data: EvaluationWorkerData) {
  const { scenario, conversationHistory, duration } = data;
  
  try {
    logger.info({ 
      sessionId: data.sessionId,
      messageCount: conversationHistory.length,
      duration 
    }, 'Generating roleplay session evaluation');

    // Build full conversation transcript
    const transcript = conversationHistory
      .map(msg => `${msg.sender.toUpperCase()}: ${msg.content}`)
      .join('\n');

    const evaluationCriteriaText = Object.entries(scenario.evaluationCriteria)
      .map(([category, criteria]) => `${category}: ${(criteria as string[]).join(', ')}`)
      .join('\n');

    const messages = [
      {
        role: 'system',
        content: `You are an expert roleplay evaluator. Analyze the following roleplay session and provide a comprehensive evaluation.

SCENARIO: ${scenario.title}
OBJECTIVES: ${scenario.scenario.objectives.join(', ')}
SUCCESS CRITERIA: ${scenario.scenario.successCriteria.join(', ')}
TARGET COMPETENCIES: ${scenario.targetCompetencies.join(', ')}

EVALUATION CRITERIA:
${evaluationCriteriaText}

FULL CONVERSATION TRANSCRIPT:
${transcript}

SESSION DURATION: ${duration} minutes

Provide evaluation in this exact JSON format:
{
  "overallScore": 0-100,
  "competencyScores": {
    "${scenario.targetCompetencies[0] || 'communication'}": 0-100,
    "${scenario.targetCompetencies[1] || 'problem-solving'}": 0-100,
    "${scenario.targetCompetencies[2] || 'professionalism'}": 0-100
  },
  "strengths": ["strength1", "strength2", "strength3"],
  "areasForImprovement": ["area1", "area2", "area3"],
  "detailedFeedback": "Comprehensive feedback paragraph",
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"]
}

Evaluate based on:
- How well objectives were met
- Quality of communication and responses
- Demonstration of target competencies
- Professional behavior and approach
- Problem-solving and adaptability`
      },
      {
        role: 'user',
        content: 'Evaluate this roleplay session. Return only the JSON evaluation.'
      }
    ];

    const result = await resilientAIProcessing('evaluation', messages, 0.3);
    
    if (!result.success) {
      throw result.error || new Error('Evaluation generation failed');
    }

    try {
      const evaluation = parseAIResponse(result.data);
      
      // Validate evaluation structure
      if (!evaluation.overallScore || !evaluation.competencyScores || 
          !evaluation.strengths || !evaluation.areasForImprovement ||
          !evaluation.detailedFeedback || !evaluation.recommendations) {
        throw new Error('Invalid evaluation response structure');
      }

      logger.info({ 
        sessionId: data.sessionId,
        overallScore: evaluation.overallScore,
        duration 
      }, 'Roleplay session evaluation generated successfully');

      return { evaluation };
    } catch (parseError: any) {
      logger.error({ 
        parseError: parseError && parseError.message ? parseError.message : String(parseError),
        response: result.data.substring(0, 500) + '...'
      }, 'Failed to parse evaluation JSON response');
      throw new Error(`Invalid JSON response from AI for evaluation: ${parseError && parseError.message ? parseError.message : String(parseError)}`);
    }
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionId: data.sessionId 
    }, 'Failed to generate roleplay evaluation');
    throw error;
  }
}

async function processRoleplayTask() {
  try {
    const data = workerData as WorkerData;
    
    logger.info({ 
      taskType: data.type,
      sessionId: data.sessionId 
    }, 'Worker starting roleplay task processing');

    let result;

    switch (data.type) {
      case 'initial-message':
        result = await processInitialMessage(data);
        break;
      case 'conversation':
        result = await processConversation(data);
        break;
      case 'evaluation':
        result = await processEvaluation(data);
        break;
      default:
        throw new Error(`Unknown roleplay task type: ${(data as any).type}`);
    }

    logger.info({ 
      taskType: data.type,
      sessionId: data.sessionId 
    }, 'Roleplay task processing completed successfully');

    parentPort?.postMessage({ success: true, data: result });
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      taskType: (workerData as WorkerData).type 
    }, 'Worker failed to process roleplay task');
    
    parentPort?.postMessage({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info({}, 'Roleplay Worker received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info({}, 'Roleplay Worker received SIGINT, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error({ error: error.message }, 'Uncaught exception in roleplay worker');
  parentPort?.postMessage({
    success: false,
    error: error.message,
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection in roleplay worker');
  parentPort?.postMessage({
    success: false,
    error: reason instanceof Error ? reason.message : 'Unhandled promise rejection',
  });
  process.exit(1);
});

// Start processing
processRoleplayTask();
```

## Phase 8: Integration with Main App

### File: Update `src/app.ts`

Add the following imports at the top:

```typescript
import { createRoleplayRepository } from './roleplay/roleplay.repositories.js';
import { createRoleplayService } from './roleplay/roleplay.services.js';
import { createRoleplayHandlers } from './roleplay/roleplay.handlers.js';
import { createRoleplayRoutes } from './roleplay/roleplay.routes.js';
```

Add to repository creation section:

```typescript
const roleplayRepository = createRoleplayRepository(db, logger);
```

Add to service creation section:

```typescript
const roleplayService = createRoleplayService(roleplayRepository, logger);
```

Add to handlers creation section:

```typescript
const roleplayHandlers = createRoleplayHandlers({
  roleplayService,
  logger,
});
```

Add route integration after other routes:

```typescript
// Roleplay routes
app.use('/api/roleplay', createRoleplayRoutes(roleplayHandlers));
```

Update the return object to include roleplay components:

```typescript
return {
  app,
  config,
  logger,
  db,
  services: {
    authService,
    learningService,
    idpService,
    documentService,
    roleplayService, // Add this
  },
  handlers: {
    authHandlers,
    learningHandlers,
    idpHandlers,
    documentHandlers,
    roleplayHandlers, // Add this
  },
  healthStatus: validationResult,
};
```

## Phase 9: Testing Script

### File: `test-roleplay.js`

```javascript
// Simple Node.js test script for roleplay endpoints
const BASE_URL = 'http://localhost:3000';

async function makeRequest(endpoint, method = 'GET', body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    console.log(`\n${method} ${endpoint}`);
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));
    
    return { response, data };
  } catch (error) {
    console.error(`Error with ${method} ${endpoint}:`, error.message);
    return { error };
  }
}

async function testRoleplayFeature() {
  console.log('🎭 Testing Roleplay Feature');
  console.log('===============================');
  
  // Test 1: Get available scenarios
  console.log('\n📋 Test 1: Get Available Scenarios');
  await makeRequest('/api/roleplay/scenarios');
  
  // Test 2: Get scenario details (use first scenario ID from seed data)
  console.log('\n📖 Test 2: Get Scenario Details');
  const { data: scenariosData } = await makeRequest('/api/roleplay/scenarios');
  
  if (scenariosData?.success && scenariosData.data?.scenarios?.length > 0) {
    const firstScenarioId = scenariosData.data.scenarios[0].id;
    await makeRequest(`/api/roleplay/scenarios/${firstScenarioId}`);
    
    // Test 3: Start roleplay session
    console.log('\n🚀 Test 3: Start Roleplay Session');
    const { data: sessionData } = await makeRequest(
      `/api/roleplay/scenarios/${firstScenarioId}/start`, 
      'POST'
    );
    
    if (sessionData?.success && sessionData.data?.sessionId) {
      const sessionId = sessionData.data.sessionId;
      
      // Test 4: Send message in session
      console.log('\n💬 Test 4: Send Message');
      await makeRequest(
        `/api/roleplay/sessions/${sessionId}/message`,
        'POST',
        { message: 'Hello, I understand you\'re having some technical issues. Can you tell me more about what\'s happening?' }
      );
      
      // Test 5: Send another message
      console.log('\n💬 Test 5: Send Another Message');
      await makeRequest(
        `/api/roleplay/sessions/${sessionId}/message`,
        'POST',
        { message: 'I apologize for the inconvenience. Let me help you resolve this issue. When exactly did the problem start occurring?' }
      );
      
      // Test 6: Get session details
      console.log('\n📊 Test 6: Get Session Details');
      await makeRequest(`/api/roleplay/sessions/${sessionId}`);
      
      // Test 7: Get session transcript
      console.log('\n📝 Test 7: Get Session Transcript');
      await makeRequest(`/api/roleplay/sessions/${sessionId}/transcript`);
      
      // Test 8: End session
      console.log('\n🏁 Test 8: End Session');
      await makeRequest(`/api/roleplay/sessions/${sessionId}/end`, 'POST');
      
      // Test 9: Get user sessions
      console.log('\n📚 Test 9: Get User Sessions');
      await makeRequest('/api/roleplay/sessions');
      
      // Test 10: Get user stats
      console.log('\n📈 Test 10: Get User Stats');
      await makeRequest('/api/roleplay/stats');
      
      // Test 11: Get scenario stats
      console.log('\n📊 Test 11: Get Scenario Stats');
      await makeRequest(`/api/roleplay/scenarios/${firstScenarioId}/stats`);
    } else {
      console.log('❌ Failed to start session, skipping session-dependent tests');
    }
  } else {
    console.log('❌ No scenarios found, skipping scenario-dependent tests');
  }
  
  console.log('\n✅ Roleplay testing completed!');
}

// Run the tests
testRoleplayFeature().catch(console.error);
```

## Phase 10: Database Migration/Seeding

### File: `seed-database.js`

```javascript
// Database seeding script
import { createDatabaseConnection } from './src/config/database.js';
import { getEnvironmentConfig } from './src/config/environment.js';
import { createLogger } from './src/config/logger.js';
import { seedRoleplayScenarios } from './src/roleplay/seed.js';

async function seedDatabase() {
  try {
    const config = getEnvironmentConfig();
    const logger = createLogger(config);
    const db = createDatabaseConnection(config);
    
    console.log('🌱 Starting database seeding...');
    
    // Seed roleplay scenarios
    await seedRoleplayScenarios(db, logger);
    
    console.log('✅ Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
```

## Implementation Steps

1. **Setup Phase**: Create all repository, service, handler, and schema files
2. **Worker Thread**: Implement the roleplay worker for AI processing
3. **Integration**: Update main app.ts to include roleplay routes
4. **Database**: Run the seeding script to populate scenarios
5. **Testing**: Use the test script to verify all endpoints work
6. **Validation**: Check logs and database for proper data flow

## API Endpoints Summary

```
GET    /api/roleplay/scenarios              - List available scenarios
GET    /api/roleplay/scenarios/:id          - Get scenario details
GET    /api/roleplay/scenarios/:id/stats    - Get scenario statistics
POST   /api/roleplay/scenarios/:id/start    - Start new session
POST   /api/roleplay/sessions/:id/message   - Send message
POST   /api/roleplay/sessions/:id/end       - End session
GET    /api/roleplay/sessions/:id           - Get session details
GET    /api/roleplay/sessions/:id/transcript- Get session transcript
GET    /api/roleplay/sessions               - Get user sessions
GET    /api/roleplay/stats                  - Get user statistics
```

## Notes

- All user authentication uses placeholder `user-123` - replace with real auth middleware
- Worker threads handle AI processing to prevent blocking main thread
- Comprehensive error handling and logging throughout
- Resilience patterns implemented for AI service calls
- Database queries optimized with proper indexing considerations
- Validation schemas ensure data integrity
- Analytics endpoints provide insights for improvement