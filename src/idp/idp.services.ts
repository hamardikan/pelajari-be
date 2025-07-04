import type { Logger } from 'pino';
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import type { IDPRepository, CompetencyGapRecord, DevelopmentProgramRecord, IndividualDevelopmentPlanRecord } from './idp.repositories.js';
import type { 
  JobCompetencyFrameworkData, 
  EmployeeData, 
  GapAnalysisInputData,
  ApproveIDPData,
  UpdateIDPProgressData,
  NineBoxClassification 
} from './idp.schemas.js';
import type { CompetencyGapData, IndividualDevelopmentPlanData } from '../db/schema.js';
import { createBusinessLogicError, createNotFoundError } from '../shared/middleware/error.middleware.js';
import * as mammoth from 'mammoth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to resolve worker path
function resolveWorkerPath(workerName: string): string {
  // Try different possible paths for the worker
  const possiblePaths = [
    // Production build (compiled)
    path.join(__dirname, '..', 'workers', `${workerName}.worker.js`),
    path.join(process.cwd(), 'dist', 'workers', `${workerName}.worker.js`),
    // Development with ts-node
    path.join(__dirname, '..', 'workers', `${workerName}.worker.ts`),
    path.join(process.cwd(), 'src', 'workers', `${workerName}.worker.ts`),
  ];

  for (const workerPath of possiblePaths) {
    if (fs.existsSync(workerPath)) {
      return workerPath;
    }
  }

  // Fallback - assume production build
  return path.join(__dirname, '..', 'workers', `${workerName}.worker.js`);
}

export type GapAnalysisResult = {
  analysisId: string;
  idpId: string;
  status: 'processing' | 'completed' | 'failed';
  message: string;
};

export type IDPGenerationResult = {
  idpId: string;
  status: 'processing' | 'completed' | 'failed';
  message: string;
};

export type ImpactMeasurementResult = {
  employeeId: string;
  overallImpact: {
    previousGapScore: number;
    currentGapScore: number;
    improvementPercentage: number;
    status: string;
  };
  competencyImpacts: Array<{
    competency: string;
    previousGapLevel: number;
    currentGapLevel: number;
    improvementLevel: string;
    notes: string;
  }>;
  insights: string[];
  recommendations: string[];
  roi: {
    qualitativeAssessment: string;
    keySuccessFactors: string[];
    areasForImprovement: string[];
  };
};

export type IDPService = {
  // Tahap 1: Analisis Kesenjangan Kompetensi
  analyzeCompetencyGaps: (frameworkData: JobCompetencyFrameworkData, employeeData: EmployeeData, userId: string) => Promise<GapAnalysisResult>;
  analyzeCompetencyGapsFromFiles: (frameworkFile: Express.Multer.File, employeeFile: Express.Multer.File, userId: string, employeeId?: string) => Promise<GapAnalysisResult>;
  getGapAnalysisByEmployeeId: (employeeId: string, requestingUserId: string) => Promise<CompetencyGapRecord>;
  listGapAnalyses: (requestingUserId: string, employeeId?: string) => Promise<CompetencyGapRecord[]>;
  
  // Tahap 2: Pemetaan Talenta 9-Box Grid
  mapTalentTo9Box: (employeeId: string, kpiScore: number, assessmentScore: number) => Promise<NineBoxClassification>;
  
  // Tahap 3: Pembuatan IDP
  generateIDP: (employeeId: string, userId: string) => Promise<IDPGenerationResult>;
  getIDPByEmployeeId: (employeeId: string, requestingUserId: string) => Promise<IndividualDevelopmentPlanRecord>;
  
  // Tahap 4: Eksekusi & Pengukuran Dampak
  approveIDP: (idpId: string, approvalData: ApproveIDPData) => Promise<IndividualDevelopmentPlanRecord>;
  updateIDPProgress: (idpId: string, progressData: UpdateIDPProgressData) => Promise<IndividualDevelopmentPlanRecord>;
  measureIDPImpact: (employeeId: string, userId: string) => Promise<ImpactMeasurementResult>;
  
  // Management Functions
  getDevelopmentPrograms: () => Promise<DevelopmentProgramRecord[]>;
  createDevelopmentProgram: (programData: any, userId: string) => Promise<DevelopmentProgramRecord>;
};

export function createIDPService(
  idpRepository: IDPRepository,
  logger: Logger,
  activeWorkers: Set<Worker>
): IDPService {

  // Tahap 1: Analisis Kesenjangan Kompetensi Otomatis
  async function analyzeCompetencyGaps(
    frameworkData: JobCompetencyFrameworkData, 
    employeeData: EmployeeData, 
    userId: string
  ): Promise<GapAnalysisResult> {
    try {
      logger.info({ 
        employeeName: employeeData.employeeName,
        jobTitle: frameworkData.jobTitle,
        userId 
      }, 'Starting competency gap analysis');

      // Dynamically determine worker path for both dev (ts) and prod (js)
      const workerPath = resolveWorkerPath('idp');

      // Start worker for AI processing
      const worker = new Worker(workerPath, {
        workerData: { 
          type: 'gap-analysis',
          frameworkData,
          employeeData,
          userId 
        },
      });

      // Track worker so it can be terminated during shutdown
      activeWorkers.add(worker);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          worker.terminate();
          reject(new Error('Gap analysis AI processing timeout after 5 minutes'));
        }, 5 * 60 * 1000); // 5 minutes timeout

        worker.on('message', async (message) => {
          clearTimeout(timeout);
          
          if (!message.success) {
            logger.error({ 
              userId, 
              employeeName: employeeData.employeeName,
              error: message.error 
            }, 'Worker failed to process gap analysis');
            
            reject(new Error(message.error));
          } else {
            try {
              // Prepare gap analysis data for storage
              const gapAnalysisData: CompetencyGapData = {
                ...message.data,
                createdBy: userId,
              };

              // Store the gap analysis result
              const newAnalysis = await idpRepository.createGapAnalysis(gapAnalysisData);

              // ---- START NEW ONE-SHOT LOGIC ----

              // 1. Generate the IDP immediately (9-box classification is now included in gap analysis)
              const idpResult = await generateIDP(gapAnalysisData.employeeId, userId);

              logger.info({
                  userId,
                  analysisId: newAnalysis.id,
                  idpId: idpResult.idpId,
                  employeeName: employeeData.employeeName,
                  nineBoxClassification: gapAnalysisData.nineBoxClassification
              }, 'One-shot process completed: Gap analysis and IDP generated with 9-box classification.');

              // 2. Resolve with both IDs
              resolve({
                analysisId: newAnalysis.id,
                idpId: idpResult.idpId, // Return the new IDP ID
                status: 'completed',
                message: 'Gap analysis and IDP generation completed successfully',
              });

              // ---- END NEW ONE-SHOT LOGIC ----

            } catch (dbError) {
              logger.error({ 
                userId, 
                employeeName: employeeData.employeeName,
                error: dbError 
              }, 'Failed during one-shot gap analysis and IDP generation');
              
              reject(dbError);
            }
          }
        });

        worker.on('error', (error) => {
          clearTimeout(timeout);
          logger.error({ 
            userId, 
            employeeName: employeeData.employeeName,
            error: error.message 
          }, 'Worker error during gap analysis');
          
          reject(error);
        });

        worker.on('exit', (code) => {
          activeWorkers.delete(worker);
          clearTimeout(timeout);
          if (code !== 0) {
            logger.error({ 
              userId, 
              employeeName: employeeData.employeeName,
              exitCode: code 
            }, 'Gap analysis worker exited with error');
            
            reject(new Error(`Gap analysis worker exited with code ${code}`));
          }
        });
      });
    } catch (error) {
      logger.error({ 
        error, 
        userId,
        employeeName: employeeData.employeeName 
      }, 'Error starting gap analysis');
      throw error;
    }
  }

  async function analyzeCompetencyGapsFromFiles(
    frameworkFile: Express.Multer.File,
    employeeFile: Express.Multer.File,
    userId: string,
    employeeId?: string
  ): Promise<GapAnalysisResult> {
    try {
      logger.info({ userId }, 'Parsing uploaded files for gap analysis');

      // Helper function to extract plain text from an uploaded file
      const extractText = async (file: Express.Multer.File): Promise<string> => {
        if (file.mimetype === 'application/pdf') {
          const data = await pdfParse(file.buffer as Buffer);
          return data.text;
        } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const { value } = await mammoth.extractRawText({ buffer: file.buffer });
          return value;
        }
        // Fallback: treat as UTF-8 text
        return file.buffer.toString('utf-8');
      };

      // Extract text concurrently
      const [frameworkText, employeeText] = await Promise.all([
        extractText(frameworkFile),
        extractText(employeeFile),
      ]);

      // Dynamically determine worker path (reuse helper)
      const workerPath = resolveWorkerPath('idp');

      logger.info({ userId }, 'Starting AI worker for gap analysis with extracted text');

      const worker = new Worker(workerPath, {
        workerData: {
          type: 'gap-analysis',
          frameworkText,
          employeeText,
          employeeName: employeeFile.originalname.split('.')[0],
          jobTitle: frameworkFile.originalname.split('.')[0],
          employeeId,
          userId,
        },
      });

      activeWorkers.add(worker);

      // Wrap worker result in promise similar to analyzeCompetencyGaps
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          worker.terminate();
          reject(new Error('Gap analysis AI processing timeout after 5 minutes'));
        }, 5 * 60 * 1000);

        worker.on('message', async (message) => {
          clearTimeout(timeout);

          if (!message.success) {
            logger.error({ userId, error: message.error }, 'Worker failed to process gap analysis');
            return reject(new Error(message.error));
          }

          try {
            const gapAnalysisData: CompetencyGapData = {
              ...message.data,
              employeeId: employeeId || message.data.employeeId,
              createdBy: userId,
            };

            // Store in DB
            const newAnalysis = await idpRepository.createGapAnalysis(gapAnalysisData);

            // ---- START NEW ONE-SHOT LOGIC ----

            // 1. Generate the IDP immediately (9-box classification is now included in gap analysis)
            const idpResult = await generateIDP(gapAnalysisData.employeeId, userId);

            logger.info({
                userId,
                analysisId: newAnalysis.id,
                idpId: idpResult.idpId,
                nineBoxClassification: gapAnalysisData.nineBoxClassification
            }, 'One-shot process completed: Gap analysis and IDP generated with 9-box classification.');

            // 2. Resolve with both IDs
            resolve({
              analysisId: newAnalysis.id,
              idpId: idpResult.idpId, // Return the new IDP ID
              status: 'completed',
              message: 'Gap analysis and IDP generation completed successfully',
            });

            // ---- END NEW ONE-SHOT LOGIC ----

          } catch (dbError) {
            logger.error({ userId, error: dbError }, 'Failed during one-shot gap analysis and IDP generation');
            reject(dbError);
          }
        });

        worker.on('error', (error) => {
          clearTimeout(timeout);
          logger.error({ userId, error: error.message }, 'Worker error during gap analysis');
          reject(error);
        });

        worker.on('exit', (code) => {
          activeWorkers.delete(worker);
          clearTimeout(timeout);
          if (code !== 0) {
            logger.error({ userId, exitCode: code }, 'Gap analysis worker exited with error');
            reject(new Error(`Gap analysis worker exited with code ${code}`));
          }
        });
      });

    } catch (error) {
      logger.error({ error, userId }, 'Error processing gap analysis from uploaded files');
      throw error;
    }
  }

  async function getGapAnalysisByEmployeeId(employeeId: string, requestingUserId: string): Promise<CompetencyGapRecord> {
    try {
      logger.debug({ employeeId, requestingUserId }, 'Fetching gap analysis for employee');
      
      const analysis = await idpRepository.getGapAnalysisByEmployeeId(employeeId, requestingUserId);
      if (!analysis) {
        throw createNotFoundError(`Gap analysis not found for employee ${employeeId}`);
      }
      
      return analysis;
    } catch (error) {
      logger.error({ error, employeeId, requestingUserId }, 'Error fetching gap analysis');
      throw error;
    }
  }

  // Tahap 2: Pemetaan & Visualisasi Talenta Otomatis (9-Box Grid)
  async function mapTalentTo9Box(
    employeeId: string, 
    kpiScore: number, 
    assessmentScore: number
  ): Promise<NineBoxClassification> {
    try {
      logger.info({ 
        employeeId, 
        kpiScore, 
        assessmentScore 
      }, 'Mapping talent to 9-Box Grid');

      // Business logic for 9-Box Grid classification
      let classification: NineBoxClassification;

      // Performance (KPI) ranges: Low (0-60), Medium (61-80), High (81-100)
      // Potential (Assessment) ranges: Low (0-60), Medium (61-80), High (81-100)
      
      if (kpiScore >= 81) { // High Performance
        if (assessmentScore >= 81) {
          classification = 'Top Talent';
        } else if (assessmentScore >= 61) {
          classification = 'Key Player';
        } else {
          classification = 'High Performer';
        }
      } else if (kpiScore >= 61) { // Medium Performance
        if (assessmentScore >= 81) {
          classification = 'Rising Star';
        } else if (assessmentScore >= 61) {
          classification = 'Core Player';
        } else {
          classification = 'High Professional';
        }
      } else { // Low Performance
        if (assessmentScore >= 81) {
          classification = 'Emerging Talent';
        } else if (assessmentScore >= 61) {
          classification = 'Inconsistent Performer';
        } else {
          classification = 'Low Performer';
        }
      }

      // Update user profile with Nine-Box classification
      await idpRepository.updateUserProfile(employeeId, {
        nineBoxClassification: classification
      });

      logger.info({ 
        employeeId, 
        classification,
        kpiScore,
        assessmentScore 
      }, 'Nine-Box classification updated successfully');

      return classification;
    } catch (error) {
      logger.error({ 
        error, 
        employeeId,
        kpiScore,
        assessmentScore 
      }, 'Error mapping talent to 9-Box Grid');
      throw error;
    }
  }

  // Tahap 3: Pembuatan Rencana Pengembangan Individual (IDP)
  async function generateIDP(employeeId: string, userId: string): Promise<IDPGenerationResult> {
    try {
      logger.info({ employeeId, userId }, 'Starting IDP generation');

      // Get prerequisite data
      const [gapAnalysis, developmentPrograms] = await Promise.all([
        idpRepository.getGapAnalysisByEmployeeId(employeeId, userId),
        idpRepository.getDevelopmentPrograms()
      ]);

      if (!gapAnalysis) {
        throw createNotFoundError(`Gap analysis not found for employee ${employeeId}. Please run gap analysis first.`);
      }

      const nineBoxClassification = gapAnalysis.data.nineBoxClassification;
      if (!nineBoxClassification) {
        throw createBusinessLogicError(`Nine-Box classification not found in gap analysis for employee ${employeeId}. Please regenerate gap analysis.`);
      }

      // Start worker for AI processing
      const workerPath = resolveWorkerPath('idp');
      const worker = new Worker(workerPath, {
        workerData: { 
          type: 'idp-generation',
          employeeId,
          employeeName: gapAnalysis.data.employeeName,
          gapAnalysisData: gapAnalysis.data,
          nineBoxClassification,
          developmentPrograms: developmentPrograms.map(p => p.data),
          userId 
        },
      });

      activeWorkers.add(worker);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          worker.terminate();
          reject(new Error('IDP generation AI processing timeout after 5 minutes'));
        }, 5 * 60 * 1000); // 5 minutes timeout

        worker.on('message', async (message) => {
          clearTimeout(timeout);
          
          if (!message.success) {
            logger.error({ 
              userId, 
              employeeId,
              error: message.error 
            }, 'Worker failed to process IDP generation');
            
            reject(new Error(message.error));
          } else {
            try {
              // Prepare IDP data for storage
              let idpData: IndividualDevelopmentPlanData = {
                ...message.data,
                gapAnalysisId: gapAnalysis.id,
                createdBy: userId,
                lastReviewDate: new Date().toISOString(),
                nextReviewDate: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 6 months from now
              };

              // Map program names to actual program IDs
              for (const goal of idpData.developmentGoals) {
                for (const program of goal.programs) {
                  // Try exact match first
                  let matchingProgram = developmentPrograms.find(p => 
                    p.data.name.toLowerCase() === program.programName.toLowerCase()
                  );
                  
                  // If no exact match, try partial match
                  if (!matchingProgram) {
                    matchingProgram = developmentPrograms.find(p => 
                      p.data.name.toLowerCase().includes(program.programName.toLowerCase()) ||
                      program.programName.toLowerCase().includes(p.data.name.toLowerCase())
                    );
                  }
                  
                  // If still no match, try by target competencies
                  if (!matchingProgram) {
                    matchingProgram = developmentPrograms.find(p => 
                      p.data.targetCompetencies.some(comp => 
                        comp.toLowerCase() === goal.competency.toLowerCase()
                      )
                    );
                  }
                  
                  if (matchingProgram) {
                    program.programId = matchingProgram.id;
                    // Update program name to match database
                    program.programName = matchingProgram.data.name;
                    program.type = matchingProgram.data.type;
                    
                    logger.info({ 
                      originalName: program.programName,
                      mappedId: matchingProgram.id,
                      mappedName: matchingProgram.data.name
                    }, 'Successfully mapped program to database UUID');
                  } else {
                    // If no match found, create a placeholder and log warning
                    logger.warn({ 
                      programName: program.programName,
                      availablePrograms: developmentPrograms.map(p => p.data.name)
                    }, 'Could not map AI-suggested program to database program');
                    
                    // Set a placeholder ID - this will cause validation error
                    // Better to fail fast than have inconsistent data
                    program.programId = 'UNMAPPED_PROGRAM_' + program.programName.replace(/\s+/g, '_');
                  }
                }
              }

              // Store the IDP
              const newIDP = await idpRepository.createIDP(idpData);
              
              logger.info({ 
                userId, 
                idpId: newIDP.id,
                employeeId,
                mappedPrograms: idpData.developmentGoals.reduce((acc, goal) => 
                  acc + goal.programs.filter(p => p.programId && !p.programId.startsWith('UNMAPPED')).length, 0
                )
              }, 'IDP generated successfully');

              resolve({
                idpId: newIDP.id,
                status: 'completed',
                message: 'IDP generated successfully'
              });
            } catch (dbError) {
              logger.error({ 
                userId, 
                employeeId,
                error: dbError 
              }, 'Failed to save IDP to database');
              
              reject(dbError);
            }
          }
        });

        worker.on('error', (error) => {
          clearTimeout(timeout);
          logger.error({ 
            userId, 
            employeeId,
            error: error.message 
          }, 'Worker error during IDP generation');
          
          reject(error);
        });

        worker.on('exit', (code) => {
          activeWorkers.delete(worker);
          clearTimeout(timeout);
          if (code !== 0) {
            logger.error({ 
              userId, 
              employeeId,
              exitCode: code 
            }, 'IDP generation worker exited with error');
            
            reject(new Error(`IDP generation worker exited with code ${code}`));
          }
        });
      });
    } catch (error) {
      logger.error({ 
        error, 
        employeeId,
        userId 
      }, 'Error starting IDP generation');
      throw error;
    }
  }

  async function getIDPByEmployeeId(employeeId: string, requestingUserId: string): Promise<IndividualDevelopmentPlanRecord> {
    try {
      logger.debug({ employeeId, requestingUserId }, 'Fetching IDP for employee');
      
      const idp = await idpRepository.getIDPByEmployeeId(employeeId, requestingUserId);
      if (!idp) {
        throw createNotFoundError(`IDP not found for employee ${employeeId}`);
      }
      
      return idp;
    } catch (error) {
      logger.error({ error, employeeId, requestingUserId }, 'Error fetching IDP');
      throw error;
    }
  }

  // Tahap 4: Eksekusi & Pengukuran Dampak
  async function approveIDP(idpId: string, approvalData: ApproveIDPData): Promise<IndividualDevelopmentPlanRecord> {
    try {
      logger.info({ idpId, managerId: approvalData.managerId }, 'Approving IDP');

      const idp = await idpRepository.getIDPById(idpId);
      if (!idp) {
        throw createNotFoundError(`IDP not found with ID ${idpId}`);
      }

      const updateData = {
        approvedByManager: true,
        managerComments: approvalData.comments,
        approvalDate: new Date().toISOString(),
        managerId: approvalData.managerId,
        overallProgress: {
          ...idp.data.overallProgress,
          status: 'Active' as const,
          startDate: new Date().toISOString(),
        }
      };

      const updatedIDP = await idpRepository.updateIDP(idpId, updateData);
      
      logger.info({ idpId, managerId: approvalData.managerId }, 'IDP approved successfully');
      return updatedIDP;
    } catch (error) {
      logger.error({ error, idpId }, 'Error approving IDP');
      throw error;
    }
  }

  async function updateIDPProgress(idpId: string, progressData: UpdateIDPProgressData): Promise<IndividualDevelopmentPlanRecord> {
    try {
      logger.info({ idpId, programId: progressData.programId }, 'Updating IDP progress');

      const idp = await idpRepository.getIDPById(idpId);
      if (!idp) {
        throw createNotFoundError(`IDP not found with ID ${idpId}`);
      }

      // Find and update the specific program
      const updatedGoals = idp.data.developmentGoals.map(goal => {
        const updatedPrograms = goal.programs.map(program => {
          if (program.programId === progressData.programId) {
            return {
              ...program,
              status: progressData.status,
              completionPercentage: progressData.completionPercentage || program.completionPercentage,
              notes: progressData.notes || program.notes,
            };
          }
          return program;
        });
        
        return {
          ...goal,
          programs: updatedPrograms
        };
      });

      // Calculate overall progress
      const totalPrograms = updatedGoals.reduce((total, goal) => total + goal.programs.length, 0);
      const completedPrograms = updatedGoals.reduce((total, goal) => 
        total + goal.programs.filter(p => p.status === 'Completed').length, 0
      );
      const overallCompletionPercentage = totalPrograms > 0 ? Math.round((completedPrograms / totalPrograms) * 100) : 0;

      const updateData = {
        developmentGoals: updatedGoals,
        overallProgress: {
          ...idp.data.overallProgress,
          completionPercentage: overallCompletionPercentage,
          status: overallCompletionPercentage === 100 ? 'Completed' as const : 'In Progress' as const,
          actualCompletionDate: overallCompletionPercentage === 100 ? new Date().toISOString() : undefined,
        }
      };

      const updatedIDP = await idpRepository.updateIDP(idpId, updateData);
      
      logger.info({ 
        idpId, 
        programId: progressData.programId,
        overallProgress: overallCompletionPercentage 
      }, 'IDP progress updated successfully');
      
      return updatedIDP;
    } catch (error) {
      logger.error({ error, idpId, programId: progressData.programId }, 'Error updating IDP progress');
      throw error;
    }
  }

  async function measureIDPImpact(employeeId: string, userId: string): Promise<ImpactMeasurementResult> {
    try {
      logger.info({ employeeId, userId }, 'Starting IDP impact measurement');

      // This would typically involve triggering a new gap analysis and comparing with the previous one
      // For now, we'll implement a simplified version that compares historical gap analyses

      const currentAnalysis = await idpRepository.getGapAnalysisByEmployeeId(employeeId, userId);
      if (!currentAnalysis) {
        throw createNotFoundError(`Current gap analysis not found for employee ${employeeId}`);
      }

      // In a real implementation, you would:
      // 1. Trigger a new gap analysis focusing on the competencies targeted in the IDP
      // 2. Compare the results with the original gap analysis
      // 3. Generate an impact report

      // For demonstration, we'll create a simplified impact report
      const mockImpactResult: ImpactMeasurementResult = {
        employeeId,
        overallImpact: {
          previousGapScore: currentAnalysis.data.overallGapScore,
          currentGapScore: Math.max(0, currentAnalysis.data.overallGapScore - 20), // Simulate improvement
          improvementPercentage: 25, // Simulate 25% improvement
          status: 'Moderate Improvement'
        },
        competencyImpacts: currentAnalysis.data.gaps.map(gap => ({
          competency: gap.competency,
          previousGapLevel: gap.gapLevel,
          currentGapLevel: Math.max(0, gap.gapLevel - 1), // Simulate improvement
          improvementLevel: gap.gapLevel > 0 ? 'Minor' : 'None',
          notes: gap.gapLevel > 0 ? 'Showing improvement through targeted development programs' : 'Maintained good performance level'
        })),
        insights: [
          'Targeted development programs have shown positive impact on key competencies',
          'Continued focus on high-priority gaps is recommended',
          'Employee engagement in development activities has been consistent'
        ],
        recommendations: [
          'Continue current development trajectory with advanced programs',
          'Consider leadership development opportunities',
          'Schedule quarterly progress reviews'
        ],
        roi: {
          qualitativeAssessment: 'The development investment has yielded measurable improvements in competency levels, contributing to enhanced job performance and employee engagement.',
          keySuccessFactors: [
            'Structured learning approach',
            'Regular progress monitoring',
            'Manager support and coaching'
          ],
          areasForImprovement: [
            'More frequent feedback sessions',
            'Peer learning opportunities',
            'Cross-functional exposure'
          ]
        }
      };

      logger.info({ employeeId, userId }, 'IDP impact measurement completed');
      return mockImpactResult;
    } catch (error) {
      logger.error({ error, employeeId, userId }, 'Error measuring IDP impact');
      throw error;
    }
  }

  // Management Functions
  async function getDevelopmentPrograms(): Promise<DevelopmentProgramRecord[]> {
    try {
      logger.debug({}, 'Fetching development programs');
      return await idpRepository.getDevelopmentPrograms();
    } catch (error) {
      logger.error({ error }, 'Error fetching development programs');
      throw error;
    }
  }

  async function createDevelopmentProgram(programData: any, userId: string): Promise<DevelopmentProgramRecord> {
    try {
      logger.info({ programName: programData.name, userId }, 'Creating development program');

      const programDataWithCreator = {
        ...programData,
        createdBy: userId,
        isActive: true,
      };

      const newProgram = await idpRepository.createDevelopmentProgram(programDataWithCreator);
      
      logger.info({ 
        programId: newProgram.id, 
        programName: programData.name,
        userId 
      }, 'Development program created successfully');
      
      return newProgram;
    } catch (error) {
      logger.error({ error, programName: programData.name, userId }, 'Error creating development program');
      throw error;
    }
  }

  async function listGapAnalyses(requestingUserId: string, employeeId?: string): Promise<CompetencyGapRecord[]> {
    return idpRepository.listGapAnalyses({ employeeId, requestingUserId });
  }

  return {
    // Tahap 1: Analisis Kesenjangan Kompetensi
    analyzeCompetencyGaps,
    analyzeCompetencyGapsFromFiles,
    getGapAnalysisByEmployeeId,
    listGapAnalyses,
    
    // Tahap 2: Pemetaan Talenta 9-Box Grid
    mapTalentTo9Box,
    
    // Tahap 3: Pembuatan IDP
    generateIDP,
    getIDPByEmployeeId,
    
    // Tahap 4: Eksekusi & Pengukuran Dampak
    approveIDP,
    updateIDPProgress,
    measureIDPImpact,
    
    // Management Functions
    getDevelopmentPrograms,
    createDevelopmentProgram,
  };
} 