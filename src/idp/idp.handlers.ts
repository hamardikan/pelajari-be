import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import type { IDPService } from './idp.services.js';
import type { RequestWithCorrelation } from '../config/logger.js';
import { createAsyncErrorWrapper } from '../shared/middleware/error.middleware.js';

export type IDPHandlerDependencies = {
  idpService: IDPService;
  logger: Logger;
};

export type IDPHandlers = {
  // Tahap 1: Gap Analysis
  analyzeCompetencyGaps: (req: Request, res: Response, next: NextFunction) => void;
  getGapAnalysisByEmployeeId: (req: Request, res: Response, next: NextFunction) => void;
  
  // Tahap 2: Nine-Box Mapping
  mapTalentTo9Box: (req: Request, res: Response, next: NextFunction) => void;
  
  // Tahap 3: IDP Generation
  generateIDP: (req: Request, res: Response, next: NextFunction) => void;
  getIDPByEmployeeId: (req: Request, res: Response, next: NextFunction) => void;
  
  // Tahap 4: IDP Execution & Impact
  approveIDP: (req: Request, res: Response, next: NextFunction) => void;
  updateIDPProgress: (req: Request, res: Response, next: NextFunction) => void;
  measureIDPImpact: (req: Request, res: Response, next: NextFunction) => void;
  
  // Management Functions
  getDevelopmentPrograms: (req: Request, res: Response, next: NextFunction) => void;
  createDevelopmentProgram: (req: Request, res: Response, next: NextFunction) => void;
};

function createIDPHandlers(dependencies: IDPHandlerDependencies): IDPHandlers {
  const { idpService, logger } = dependencies;

  // Tahap 1: Analisis Kesenjangan Kompetensi
  async function analyzeCompetencyGaps(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      // For now, we'll use a dummy user ID. In production, this would come from authentication
      const userId = 'user-123'; // TODO: Get from authentication middleware
      
      const { frameworkData, employeeData } = req.body;

      logger.info({ 
        correlationId, 
        userId, 
        employeeName: employeeData.employeeName,
        jobTitle: frameworkData.jobTitle
      }, 'Processing gap analysis request');
      
      const result = await idpService.analyzeCompetencyGaps(frameworkData, employeeData, userId);
      
      logger.info({ 
        correlationId, 
        userId, 
        analysisId: result.analysisId,
        status: result.status 
      }, 'Gap analysis request processed');
      
      res.status(201).json({
        success: true,
        message: 'Gap analysis initiated successfully',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        employeeName: req.body?.employeeData?.employeeName,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Gap analysis request failed');
      
      next(error);
    }
  }

  async function getGapAnalysisByEmployeeId(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const { employeeId } = req.params;
      
      if (!employeeId) {
        res.status(400).json({
          success: false,
          message: 'Employee ID is required',
          correlationId,
        });
        return;
      }
      
      logger.debug({ correlationId, employeeId }, 'Fetching gap analysis for employee');
      
      const analysis = await idpService.getGapAnalysisByEmployeeId(employeeId);
      
      res.json({
        success: true,
        message: 'Gap analysis retrieved successfully',
        data: { analysis },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        employeeId: req.params.employeeId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Gap analysis retrieval failed');
      
      next(error);
    }
  }

  // Tahap 2: Pemetaan Talenta 9-Box Grid
  async function mapTalentTo9Box(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const { employeeId } = req.params;
      const { kpiScore, assessmentScore } = req.body;

      if (!employeeId) {
        res.status(400).json({
          success: false,
          message: 'Employee ID is required',
          correlationId,
        });
        return;
      }

      logger.info({ 
        correlationId, 
        employeeId,
        kpiScore,
        assessmentScore 
      }, 'Processing Nine-Box mapping request');
      
      const classification = await idpService.mapTalentTo9Box(employeeId, kpiScore, assessmentScore);
      
      logger.info({ 
        correlationId, 
        employeeId,
        classification 
      }, 'Nine-Box mapping completed');
      
      res.json({
        success: true,
        message: 'Nine-Box mapping completed successfully',
        data: { classification },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        employeeId: req.params.employeeId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Nine-Box mapping failed');
      
      next(error);
    }
  }

  // Tahap 3: Pembuatan IDP
  async function generateIDP(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      // For now, we'll use a dummy user ID. In production, this would come from authentication
      const userId = 'user-123'; // TODO: Get from authentication middleware
      const { employeeId } = req.params;

      if (!employeeId) {
        res.status(400).json({
          success: false,
          message: 'Employee ID is required',
          correlationId,
        });
        return;
      }

      logger.info({ 
        correlationId, 
        userId, 
        employeeId
      }, 'Processing IDP generation request');
      
      const result = await idpService.generateIDP(employeeId, userId);
      
      logger.info({ 
        correlationId, 
        userId, 
        idpId: result.idpId,
        status: result.status 
      }, 'IDP generation request processed');
      
      res.status(201).json({
        success: true,
        message: 'IDP generation initiated successfully',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        employeeId: req.params.employeeId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'IDP generation request failed');
      
      next(error);
    }
  }

  async function getIDPByEmployeeId(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const { employeeId } = req.params;
      
      if (!employeeId) {
        res.status(400).json({
          success: false,
          message: 'Employee ID is required',
          correlationId,
        });
        return;
      }
      
      logger.debug({ correlationId, employeeId }, 'Fetching IDP for employee');
      
      const idp = await idpService.getIDPByEmployeeId(employeeId);
      
      res.json({
        success: true,
        message: 'IDP retrieved successfully',
        data: { idp },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        employeeId: req.params.employeeId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'IDP retrieval failed');
      
      next(error);
    }
  }

  // Tahap 4: Eksekusi & Pengukuran Dampak
  async function approveIDP(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const { idpId } = req.params;
      const approvalData = req.body;

      if (!idpId) {
        res.status(400).json({
          success: false,
          message: 'IDP ID is required',
          correlationId,
        });
        return;
      }

      logger.info({ 
        correlationId, 
        idpId,
        managerId: approvalData.managerId
      }, 'Processing IDP approval request');
      
      const updatedIDP = await idpService.approveIDP(idpId, approvalData);
      
      logger.info({ 
        correlationId, 
        idpId,
        managerId: approvalData.managerId
      }, 'IDP approved successfully');
      
      res.json({
        success: true,
        message: 'IDP approved successfully',
        data: { idp: updatedIDP },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        idpId: req.params.idpId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'IDP approval failed');
      
      next(error);
    }
  }

  async function updateIDPProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const { idpId } = req.params;
      const progressData = req.body;

      if (!idpId) {
        res.status(400).json({
          success: false,
          message: 'IDP ID is required',
          correlationId,
        });
        return;
      }

      logger.info({ 
        correlationId, 
        idpId,
        programId: progressData.programId,
        status: progressData.status
      }, 'Processing IDP progress update');
      
      const updatedIDP = await idpService.updateIDPProgress(idpId, progressData);
      
      logger.info({ 
        correlationId, 
        idpId,
        programId: progressData.programId,
        overallProgress: updatedIDP.data.overallProgress.completionPercentage
      }, 'IDP progress updated successfully');
      
      res.json({
        success: true,
        message: 'IDP progress updated successfully',
        data: { idp: updatedIDP },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        idpId: req.params.idpId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'IDP progress update failed');
      
      next(error);
    }
  }

  async function measureIDPImpact(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      // For now, we'll use a dummy user ID. In production, this would come from authentication
      const userId = 'user-123'; // TODO: Get from authentication middleware
      const { employeeId } = req.params;

      if (!employeeId) {
        res.status(400).json({
          success: false,
          message: 'Employee ID is required',
          correlationId,
        });
        return;
      }

      logger.info({ 
        correlationId, 
        userId, 
        employeeId
      }, 'Processing IDP impact measurement request');
      
      const impactReport = await idpService.measureIDPImpact(employeeId, userId);
      
      logger.info({ 
        correlationId, 
        userId, 
        employeeId,
        improvementPercentage: impactReport.overallImpact.improvementPercentage
      }, 'IDP impact measurement completed');
      
      res.json({
        success: true,
        message: 'IDP impact measurement completed successfully',
        data: { impact: impactReport },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        employeeId: req.params.employeeId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'IDP impact measurement failed');
      
      next(error);
    }
  }

  // Management Functions
  async function getDevelopmentPrograms(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      logger.debug({ correlationId }, 'Fetching development programs');
      
      const programs = await idpService.getDevelopmentPrograms();
      
      res.json({
        success: true,
        message: 'Development programs retrieved successfully',
        data: { programs },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Development programs retrieval failed');
      
      next(error);
    }
  }

  async function createDevelopmentProgram(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      // For now, we'll use a dummy user ID. In production, this would come from authentication
      const userId = 'user-123'; // TODO: Get from authentication middleware
      const programData = req.body;

      logger.info({ 
        correlationId, 
        userId, 
        programName: programData.name
      }, 'Creating development program');
      
      const newProgram = await idpService.createDevelopmentProgram(programData, userId);
      
      logger.info({ 
        correlationId, 
        userId, 
        programId: newProgram.id,
        programName: programData.name 
      }, 'Development program created successfully');
      
      res.status(201).json({
        success: true,
        message: 'Development program created successfully',
        data: { program: newProgram },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        programName: req.body?.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'Development program creation failed');
      
      next(error);
    }
  }

  // Wrap all async functions with error handling
  return {
    analyzeCompetencyGaps: createAsyncErrorWrapper(analyzeCompetencyGaps),
    getGapAnalysisByEmployeeId: createAsyncErrorWrapper(getGapAnalysisByEmployeeId),
    mapTalentTo9Box: createAsyncErrorWrapper(mapTalentTo9Box),
    generateIDP: createAsyncErrorWrapper(generateIDP),
    getIDPByEmployeeId: createAsyncErrorWrapper(getIDPByEmployeeId),
    approveIDP: createAsyncErrorWrapper(approveIDP),
    updateIDPProgress: createAsyncErrorWrapper(updateIDPProgress),
    measureIDPImpact: createAsyncErrorWrapper(measureIDPImpact),
    getDevelopmentPrograms: createAsyncErrorWrapper(getDevelopmentPrograms),
    createDevelopmentProgram: createAsyncErrorWrapper(createDevelopmentProgram),
  };
}

export { createIDPHandlers }; 