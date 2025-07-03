import { eq, and, sql } from 'drizzle-orm';
import type { Database } from '../config/database.js';
import type { Logger } from 'pino';
import { 
  competencyGaps, 
  developmentPrograms, 
  individualDevelopmentPlans, 
  users 
} from '../db/schema.js';
import type { 
  CompetencyGapData, 
  DevelopmentProgramData, 
  IndividualDevelopmentPlanData,
  UserData 
} from '../db/schema.js';

export type CompetencyGapRecord = {
  id: string;
  data: CompetencyGapData;
  createdAt: Date;
  updatedAt: Date;
};

export type DevelopmentProgramRecord = {
  id: string;
  data: DevelopmentProgramData;
  createdAt: Date;
  updatedAt: Date;
};

export type IndividualDevelopmentPlanRecord = {
  id: string;
  data: IndividualDevelopmentPlanData;
  createdAt: Date;
  updatedAt: Date;
};

export type UserRecord = {
  id: string;
  data: UserData;
  createdAt: Date;
  updatedAt: Date;
};

export type IDPRepository = {
  // Competency Gap Analysis
  createGapAnalysis: (analysisData: CompetencyGapData) => Promise<CompetencyGapRecord>;
  getGapAnalysisByEmployeeId: (employeeId: string, requestingUserId?: string) => Promise<CompetencyGapRecord | null>;
  getGapAnalysisById: (id: string) => Promise<CompetencyGapRecord | null>;
  updateGapAnalysis: (id: string, analysisData: Partial<CompetencyGapData>) => Promise<CompetencyGapRecord>;
  listGapAnalyses: (filters: { employeeId?: string; requestingUserId: string }) => Promise<CompetencyGapRecord[]>;
  
  // Development Programs
  getDevelopmentPrograms: () => Promise<DevelopmentProgramRecord[]>;
  createDevelopmentProgram: (programData: DevelopmentProgramData) => Promise<DevelopmentProgramRecord>;
  getDevelopmentProgramById: (id: string) => Promise<DevelopmentProgramRecord | null>;
  updateDevelopmentProgram: (id: string, programData: Partial<DevelopmentProgramData>) => Promise<DevelopmentProgramRecord>;
  deleteDevelopmentProgram: (id: string) => Promise<void>;
  
  // Individual Development Plans
  createIDP: (idpData: IndividualDevelopmentPlanData) => Promise<IndividualDevelopmentPlanRecord>;
  getIDPByEmployeeId: (employeeId: string, requestingUserId?: string) => Promise<IndividualDevelopmentPlanRecord | null>;
  getIDPById: (id: string) => Promise<IndividualDevelopmentPlanRecord | null>;
  updateIDP: (id: string, idpData: Partial<IndividualDevelopmentPlanData>) => Promise<IndividualDevelopmentPlanRecord>;
  deleteIDP: (id: string) => Promise<void>;
  
  // User Profile Management (for Nine-Box classification)
  updateUserProfile: (userIdentifier: string, profileData: Partial<UserData['profileData']>) => Promise<UserRecord>;
  getUserById: (userId: string) => Promise<UserRecord | null>;
};

export function createIDPRepository(db: Database, logger: Logger): IDPRepository {
  
  // Competency Gap Analysis methods
  async function createGapAnalysis(analysisData: CompetencyGapData): Promise<CompetencyGapRecord> {
    try {
      logger.info({ 
        employeeId: analysisData.employeeId, 
        employeeName: analysisData.employeeName 
      }, 'Creating competency gap analysis');
      
      const result = await db
        .insert(competencyGaps)
        .values({ data: analysisData })
        .returning();

      const newAnalysis = result[0];
      if (!newAnalysis) {
        throw new Error('Failed to create gap analysis - no result returned');
      }
      
      logger.info({ 
        analysisId: newAnalysis.id, 
        employeeId: analysisData.employeeId 
      }, 'Gap analysis created successfully');

      return {
        id: newAnalysis.id,
        data: newAnalysis.data as CompetencyGapData,
        createdAt: newAnalysis.createdAt,
        updatedAt: newAnalysis.updatedAt,
      };
    } catch (error) {
      logger.error({ 
        error, 
        employeeId: analysisData.employeeId 
      }, 'Error creating gap analysis');
      throw error;
    }
  }

  async function getGapAnalysisByEmployeeId(employeeId: string, requestingUserId?: string): Promise<CompetencyGapRecord | null> {
    try {
      logger.debug({ employeeId }, 'Finding gap analysis by employee ID');
      
      const condition = requestingUserId
        ? sql`(${competencyGaps.data}->>'employeeId' = ${employeeId} OR ${competencyGaps.data}->>'createdBy' = ${requestingUserId})`
        : eq(sql`${competencyGaps.data}->>'employeeId'`, employeeId);

      const result = await db
        .select()
        .from(competencyGaps)
        .where(condition)
        .orderBy(sql`${competencyGaps.createdAt} DESC`)
        .limit(1);

      if (result.length === 0) {
        logger.debug({ employeeId }, 'Gap analysis not found for employee');
        return null;
      }

      const analysis = result[0];
      if (!analysis) {
        return null;
      }
      
      return {
        id: analysis.id,
        data: analysis.data as CompetencyGapData,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
      };
    } catch (error) {
      logger.error({ error, employeeId }, 'Error finding gap analysis by employee ID');
      throw error;
    }
  }

  async function getGapAnalysisById(id: string): Promise<CompetencyGapRecord | null> {
    try {
      logger.debug({ analysisId: id }, 'Finding gap analysis by ID');
      
      const result = await db
        .select()
        .from(competencyGaps)
        .where(eq(competencyGaps.id, id))
        .limit(1);

      if (result.length === 0) {
        logger.debug({ analysisId: id }, 'Gap analysis not found by ID');
        return null;
      }

      const analysis = result[0];
      if (!analysis) {
        return null;
      }
      
      return {
        id: analysis.id,
        data: analysis.data as CompetencyGapData,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
      };
    } catch (error) {
      logger.error({ error, analysisId: id }, 'Error finding gap analysis by ID');
      throw error;
    }
  }

  async function updateGapAnalysis(id: string, analysisData: Partial<CompetencyGapData>): Promise<CompetencyGapRecord> {
    try {
      logger.info({ analysisId: id }, 'Updating gap analysis');
      
      await db
        .update(competencyGaps)
        .set({
          data: sql`${competencyGaps.data} || ${JSON.stringify(analysisData)}`,
          updatedAt: new Date(),
        })
        .where(eq(competencyGaps.id, id));

      const updatedAnalysis = await getGapAnalysisById(id);
      if (!updatedAnalysis) {
        throw new Error('Gap analysis not found after update');
      }

      logger.info({ analysisId: id }, 'Gap analysis updated successfully');
      return updatedAnalysis;
    } catch (error) {
      logger.error({ error, analysisId: id }, 'Error updating gap analysis');
      throw error;
    }
  }

  async function listGapAnalyses(filters: { employeeId?: string; requestingUserId: string }): Promise<CompetencyGapRecord[]> {
    const { employeeId, requestingUserId } = filters;
    try {
      logger.debug({ employeeId, requestingUserId }, 'Listing gap analyses');
      const whereCondition = employeeId
        ? sql`(${competencyGaps.data}->>'employeeId' = ${employeeId} OR ${competencyGaps.data}->>'createdBy' = ${requestingUserId})`
        : eq(sql`${competencyGaps.data}->>'createdBy'`, requestingUserId);

      const result = await db
        .select()
        .from(competencyGaps)
        .where(whereCondition)
        .orderBy(sql`${competencyGaps.createdAt} DESC`);

      return result.map(r => ({
        id: r.id,
        data: r.data as CompetencyGapData,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    } catch (error) {
      logger.error({ error, filters }, 'Error listing gap analyses');
      throw error;
    }
  }

  // Development Programs methods
  async function getDevelopmentPrograms(): Promise<DevelopmentProgramRecord[]> {
    try {
      logger.debug({}, 'Fetching all development programs');
      
      const result = await db
        .select()
        .from(developmentPrograms)
        .where(eq(sql`${developmentPrograms.data}->>'isActive'`, 'true'))
        .orderBy(sql`${developmentPrograms.data}->>'name' ASC`);

      const programs = result.map(program => ({
        id: program.id,
        data: program.data as DevelopmentProgramData,
        createdAt: program.createdAt,
        updatedAt: program.updatedAt,
      }));

      logger.info({ programCount: programs.length }, 'Development programs retrieved successfully');
      return programs;
    } catch (error) {
      logger.error({ error }, 'Error fetching development programs');
      throw error;
    }
  }

  async function createDevelopmentProgram(programData: DevelopmentProgramData): Promise<DevelopmentProgramRecord> {
    try {
      logger.info({ programName: programData.name }, 'Creating development program');
      
      const result = await db
        .insert(developmentPrograms)
        .values({ data: programData })
        .returning();

      const newProgram = result[0];
      if (!newProgram) {
        throw new Error('Failed to create development program - no result returned');
      }
      
      logger.info({ 
        programId: newProgram.id, 
        programName: programData.name 
      }, 'Development program created successfully');

      return {
        id: newProgram.id,
        data: newProgram.data as DevelopmentProgramData,
        createdAt: newProgram.createdAt,
        updatedAt: newProgram.updatedAt,
      };
    } catch (error) {
      logger.error({ error, programName: programData.name }, 'Error creating development program');
      throw error;
    }
  }

  async function getDevelopmentProgramById(id: string): Promise<DevelopmentProgramRecord | null> {
    try {
      logger.debug({ programId: id }, 'Finding development program by ID');
      
      const result = await db
        .select()
        .from(developmentPrograms)
        .where(eq(developmentPrograms.id, id))
        .limit(1);

      if (result.length === 0) {
        logger.debug({ programId: id }, 'Development program not found by ID');
        return null;
      }

      const program = result[0];
      if (!program) {
        return null;
      }
      
      return {
        id: program.id,
        data: program.data as DevelopmentProgramData,
        createdAt: program.createdAt,
        updatedAt: program.updatedAt,
      };
    } catch (error) {
      logger.error({ error, programId: id }, 'Error finding development program by ID');
      throw error;
    }
  }

  async function updateDevelopmentProgram(id: string, programData: Partial<DevelopmentProgramData>): Promise<DevelopmentProgramRecord> {
    try {
      logger.info({ programId: id }, 'Updating development program');
      
      await db
        .update(developmentPrograms)
        .set({
          data: sql`${developmentPrograms.data} || ${JSON.stringify(programData)}`,
          updatedAt: new Date(),
        })
        .where(eq(developmentPrograms.id, id));

      const updatedProgram = await getDevelopmentProgramById(id);
      if (!updatedProgram) {
        throw new Error('Development program not found after update');
      }

      logger.info({ programId: id }, 'Development program updated successfully');
      return updatedProgram;
    } catch (error) {
      logger.error({ error, programId: id }, 'Error updating development program');
      throw error;
    }
  }

  async function deleteDevelopmentProgram(id: string): Promise<void> {
    try {
      logger.info({ programId: id }, 'Deleting development program');
      
      await db
        .delete(developmentPrograms)
        .where(eq(developmentPrograms.id, id));

      logger.info({ programId: id }, 'Development program deleted successfully');
    } catch (error) {
      logger.error({ error, programId: id }, 'Error deleting development program');
      throw error;
    }
  }

  // Individual Development Plans methods
  async function createIDP(idpData: IndividualDevelopmentPlanData): Promise<IndividualDevelopmentPlanRecord> {
    try {
      logger.info({ 
        employeeId: idpData.employeeId, 
        employeeName: idpData.employeeName 
      }, 'Creating individual development plan');
      
      const result = await db
        .insert(individualDevelopmentPlans)
        .values({ data: idpData })
        .returning();

      const newIDP = result[0];
      if (!newIDP) {
        throw new Error('Failed to create IDP - no result returned');
      }
      
      logger.info({ 
        idpId: newIDP.id, 
        employeeId: idpData.employeeId 
      }, 'IDP created successfully');

      return {
        id: newIDP.id,
        data: newIDP.data as IndividualDevelopmentPlanData,
        createdAt: newIDP.createdAt,
        updatedAt: newIDP.updatedAt,
      };
    } catch (error) {
      logger.error({ 
        error, 
        employeeId: idpData.employeeId 
      }, 'Error creating IDP');
      throw error;
    }
  }

  async function getIDPByEmployeeId(employeeId: string, requestingUserId?: string): Promise<IndividualDevelopmentPlanRecord | null> {
    try {
      logger.debug({ employeeId }, 'Finding IDP by employee ID');
      
      const condition = requestingUserId
        ? sql`(${individualDevelopmentPlans.data}->>'employeeId' = ${employeeId} OR ${individualDevelopmentPlans.data}->>'createdBy' = ${requestingUserId})`
        : eq(sql`${individualDevelopmentPlans.data}->>'employeeId'`, employeeId);

      const result = await db
        .select()
        .from(individualDevelopmentPlans)
        .where(condition)
        .orderBy(sql`${individualDevelopmentPlans.createdAt} DESC`)
        .limit(1);

      if (result.length === 0) {
        logger.debug({ employeeId }, 'IDP not found for employee');
        return null;
      }

      const idp = result[0];
      if (!idp) {
        return null;
      }
      
      return {
        id: idp.id,
        data: idp.data as IndividualDevelopmentPlanData,
        createdAt: idp.createdAt,
        updatedAt: idp.updatedAt,
      };
    } catch (error) {
      logger.error({ error, employeeId }, 'Error finding IDP by employee ID');
      throw error;
    }
  }

  async function getIDPById(id: string): Promise<IndividualDevelopmentPlanRecord | null> {
    try {
      logger.debug({ idpId: id }, 'Finding IDP by ID');
      
      const result = await db
        .select()
        .from(individualDevelopmentPlans)
        .where(eq(individualDevelopmentPlans.id, id))
        .limit(1);

      if (result.length === 0) {
        logger.debug({ idpId: id }, 'IDP not found by ID');
        return null;
      }

      const idp = result[0];
      if (!idp) {
        return null;
      }
      
      return {
        id: idp.id,
        data: idp.data as IndividualDevelopmentPlanData,
        createdAt: idp.createdAt,
        updatedAt: idp.updatedAt,
      };
    } catch (error) {
      logger.error({ error, idpId: id }, 'Error finding IDP by ID');
      throw error;
    }
  }

  async function updateIDP(id: string, idpData: Partial<IndividualDevelopmentPlanData>): Promise<IndividualDevelopmentPlanRecord> {
    try {
      logger.info({ idpId: id }, 'Updating IDP');
      
      await db
        .update(individualDevelopmentPlans)
        .set({
          data: sql`${individualDevelopmentPlans.data} || ${JSON.stringify(idpData)}`,
          updatedAt: new Date(),
        })
        .where(eq(individualDevelopmentPlans.id, id));

      const updatedIDP = await getIDPById(id);
      if (!updatedIDP) {
        throw new Error('IDP not found after update');
      }

      logger.info({ idpId: id }, 'IDP updated successfully');
      return updatedIDP;
    } catch (error) {
      logger.error({ error, idpId: id }, 'Error updating IDP');
      throw error;
    }
  }

  async function deleteIDP(id: string): Promise<void> {
    try {
      logger.info({ idpId: id }, 'Deleting IDP');
      
      await db
        .delete(individualDevelopmentPlans)
        .where(eq(individualDevelopmentPlans.id, id));

      logger.info({ idpId: id }, 'IDP deleted successfully');
    } catch (error) {
      logger.error({ error, idpId: id }, 'Error deleting IDP');
      throw error;
    }
  }

  // User Profile Management methods
  async function updateUserProfile(userIdentifier: string, profileData: Partial<UserData['profileData']>): Promise<UserRecord> {
    try {
      logger.info({ userIdentifier }, 'Updating user profile for Nine-Box classification');
      
      // 1. Locate the correct user row ------------------------------------
      let userRecord: UserRecord | null = null;

      // Attempt primary-key lookup only if the identifier looks like a UUID
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(userIdentifier)) {
        userRecord = await getUserById(userIdentifier);
      }

      // Fallback: locate by employeeId stored inside JSONB
      if (!userRecord) {
        const result = await db
          .select()
          .from(users)
          .where(sql`${users.data}->>'employeeId' = ${userIdentifier}`)
          .limit(1);

        if (result.length === 0) {
          throw new Error('User not found for profile update');
        }

        userRecord = result[0] as typeof result[0] & { data: UserData };
      }

      // 2. Perform the JSONB merge update using the row's UUID -------------
      const record = userRecord!; // Non-null after checks above

      await db
        .update(users)
        .set({
          data: sql`jsonb_set(${users.data}, '{profileData}', ${users.data}#>'{profileData}' || ${JSON.stringify(profileData)})`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, record.id));

      logger.info({ userId: record.id }, 'User profile updated successfully');
      return {
        id: record.id,
        data: record.data as UserData,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };
    } catch (error) {
      logger.error({ error, userIdentifier }, 'Error updating user profile');
      throw error;
    }
  }

  async function getUserById(userId: string): Promise<UserRecord | null> {
    try {
      logger.debug({ userId }, 'Finding user by ID');
      
      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (result.length === 0) {
        logger.debug({ userId }, 'User not found by ID');
        return null;
      }

      const user = result[0];
      if (!user) {
        return null;
      }
      
      return {
        id: user.id,
        data: user.data as UserData,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      logger.error({ error, userId }, 'Error finding user by ID');
      throw error;
    }
  }

  return {
    // Competency Gap Analysis
    createGapAnalysis,
    getGapAnalysisByEmployeeId,
    getGapAnalysisById,
    updateGapAnalysis,
    listGapAnalyses,
    
    // Development Programs
    getDevelopmentPrograms,
    createDevelopmentProgram,
    getDevelopmentProgramById,
    updateDevelopmentProgram,
    deleteDevelopmentProgram,
    
    // Individual Development Plans
    createIDP,
    getIDPByEmployeeId,
    getIDPById,
    updateIDP,
    deleteIDP,
    
    // User Profile Management
    updateUserProfile,
    getUserById,
  };
} 