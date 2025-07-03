import { Router } from 'express';
import type { IDPHandlers } from './idp.handlers.js';
import {
  validateBody,
  validateParams,
  validateConditionally,
} from '../shared/middleware/validation.middleware.js';
import {
  gapAnalysisInputSchema,
  employeeIdParamsSchema,
  idpIdParamsSchema,
  approveIDPSchema,
  updateIDPProgressSchema,
  developmentProgramSchema,
} from './idp.schemas.js';
import multer from 'multer';

export function createIDPRoutes(idpHandlers: IDPHandlers): Router {
  const router = Router();

  // Add multer middleware for handling file uploads (PDF/JSON)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  });

  // Tahap 1: Analisis Kesenjangan Kompetensi
  router.post(
    '/gap-analysis',
    upload.fields([
      { name: 'frameworkFile', maxCount: 1 },
      { name: 'employeeFile', maxCount: 1 },
    ]),
    validateConditionally(
      (req) => {
        const files = req.files as
          | { [fieldname:string]: Express.Multer.File[] }
          | undefined;
        // Validate body ONLY if files are not present
        return !files || !files.frameworkFile || !files.employeeFile;
      },
      gapAnalysisInputSchema
    ),
    idpHandlers.analyzeCompetencyGaps
  );

  router.get(
    '/gap-analysis/:employeeId',
    validateParams(employeeIdParamsSchema),
    idpHandlers.getGapAnalysisByEmployeeId
  );

  // Tahap 2: Pemetaan Talenta 9-Box Grid
  router.post(
    '/employees/:employeeId/nine-box',
    validateParams(employeeIdParamsSchema),
    idpHandlers.mapTalentTo9Box
  );

  // Tahap 3: Pembuatan IDP
  router.post(
    '/generate/:employeeId',
    validateParams(employeeIdParamsSchema),
    idpHandlers.generateIDP
  );

  router.get(
    '/employees/:employeeId',
    validateParams(employeeIdParamsSchema),
    idpHandlers.getIDPByEmployeeId
  );

  // Tahap 4: Eksekusi & Pengukuran Dampak
  router.put(
    '/:idpId/approve',
    validateParams(idpIdParamsSchema),
    validateBody(approveIDPSchema),
    idpHandlers.approveIDP
  );

  router.put(
    '/:idpId/progress',
    validateParams(idpIdParamsSchema),
    validateBody(updateIDPProgressSchema),
    idpHandlers.updateIDPProgress
  );

  router.get(
    '/employees/:employeeId/impact',
    validateParams(employeeIdParamsSchema),
    idpHandlers.measureIDPImpact
  );

  // Management Functions
  router.get(
    '/programs',
    idpHandlers.getDevelopmentPrograms
  );

  router.post(
    '/programs',
    validateBody(developmentProgramSchema),
    idpHandlers.createDevelopmentProgram
  );

  // list
  router.get('/gap-analysis', idpHandlers.listGapAnalyses);

  return router;
} 