import { Router } from 'express';
import multer from 'multer';
import type { DocumentHandlers } from './documents.handlers.js';
import { validateBody, validateParams, validateQuery } from '../shared/middleware/validation.middleware.js';
import {
  createDocumentSchema,
  updateDocumentSchema,
  documentsQuerySchema,
  documentIdParamsSchema,
} from './documents.schemas.js';

// Multer configuration for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

export function createDocumentRoutes(documentHandlers: DocumentHandlers): Router {
  const router = Router();

  // Document endpoints
  router.post(
    '/',
    upload.single('file'),
    validateBody(createDocumentSchema),
    documentHandlers.uploadDocument
  );

  router.get(
    '/',
    validateQuery(documentsQuerySchema),
    documentHandlers.getDocuments
  );

  router.get(
    '/:documentId',
    validateParams(documentIdParamsSchema),
    documentHandlers.getDocument
  );

  router.put(
    '/:documentId',
    validateParams(documentIdParamsSchema),
    validateBody(updateDocumentSchema),
    documentHandlers.updateDocument
  );

  router.delete(
    '/:documentId',
    validateParams(documentIdParamsSchema),
    documentHandlers.deleteDocument
  );

  router.get(
    '/:documentId/content',
    validateParams(documentIdParamsSchema),
    documentHandlers.getDocumentContent
  );

  return router;
} 