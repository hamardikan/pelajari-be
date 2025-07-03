import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import type { DocumentService, FileUploadData } from './documents.services.js';
import type { RequestWithCorrelation } from '../config/logger.js';
import { createAsyncErrorWrapper } from '../shared/middleware/error.middleware.js';
import type { CreateDocumentData, UpdateDocumentData, DocumentsQuery, DocumentIdParams } from './documents.schemas.js';

export type DocumentHandlerDependencies = {
  documentService: DocumentService;
  logger: Logger;
};

export type DocumentHandlers = {
  uploadDocument: (req: Request, res: Response, next: NextFunction) => void;
  getDocument: (req: Request, res: Response, next: NextFunction) => void;
  getDocuments: (req: Request, res: Response, next: NextFunction) => void;
  updateDocument: (req: Request, res: Response, next: NextFunction) => void;
  deleteDocument: (req: Request, res: Response, next: NextFunction) => void;
  getDocumentContent: (req: Request, res: Response, next: NextFunction) => void;
};

function createDocumentHandlers(dependencies: DocumentHandlerDependencies): DocumentHandlers {
  const { documentService, logger } = dependencies;

  async function uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const userId = (req as any).user.userId;
      
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded',
          correlationId,
        });
        return;
      }

      const fileData: FileUploadData = {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      };

      const metadata = req.body as CreateDocumentData; // Should be validated by middleware

      logger.info({ correlationId, userId, fileName: fileData.originalname }, 'Processing document upload');
      
      const document = await documentService.uploadDocument(userId, fileData, metadata);
      
      logger.info({ correlationId, documentId: document.id }, 'Document uploaded successfully');
      
      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        data: { document },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        fileName: req.file?.originalname, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Document upload failed');
      next(error);
    }
  }

  async function getDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const { documentId } = req.params as DocumentIdParams;

      logger.debug({ correlationId, documentId }, 'Retrieving document');
      
      const document = await documentService.getDocument(documentId);
      
      logger.info({ correlationId, documentId }, 'Document retrieved successfully');
      
      res.status(200).json({
        success: true,
        message: 'Document retrieved successfully',
        data: { document },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        documentId: req.params.documentId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to retrieve document');
      next(error);
    }
  }

  async function getDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const options = req.query as unknown as DocumentsQuery; // Should be validated by middleware

      logger.debug({ correlationId, options }, 'Retrieving documents');
      
      const result = await documentService.getDocuments(options);
      
      logger.info({ 
        correlationId, 
        totalDocuments: result.total,
        returnedDocuments: result.documents.length 
      }, 'Documents retrieved successfully');
      
      res.status(200).json({
        success: true,
        message: 'Documents retrieved successfully',
        data: result,
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to retrieve documents');
      next(error);
    }
  }

  async function updateDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const { documentId } = req.params as DocumentIdParams;
      const updateData = req.body as UpdateDocumentData; // Should be validated by middleware

      logger.debug({ correlationId, documentId, updateData }, 'Updating document');
      
      const document = await documentService.updateDocument(documentId, updateData);
      
      logger.info({ correlationId, documentId }, 'Document updated successfully');
      
      res.status(200).json({
        success: true,
        message: 'Document updated successfully',
        data: { document },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        documentId: req.params.documentId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to update document');
      next(error);
    }
  }

  async function deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const { documentId } = req.params as DocumentIdParams;

      logger.debug({ correlationId, documentId }, 'Deleting document');
      
      await documentService.deleteDocument(documentId);
      
      logger.info({ correlationId, documentId }, 'Document deleted successfully');
      
      res.status(200).json({
        success: true,
        message: 'Document deleted successfully',
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        documentId: req.params.documentId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to delete document');
      next(error);
    }
  }

  async function getDocumentContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithCorrelation).correlationId;
    
    try {
      const { documentId } = req.params as DocumentIdParams;

      logger.debug({ correlationId, documentId }, 'Getting document content');
      
      const content = await documentService.getDocumentContent(documentId);
      
      logger.info({ correlationId, documentId }, 'Document content retrieved successfully');
      
      res.status(200).json({
        success: true,
        message: 'Document content retrieved successfully',
        data: { content },
        correlationId,
      });
    } catch (error) {
      logger.error({ 
        correlationId, 
        documentId: req.params.documentId,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to get document content');
      next(error);
    }
  }

  return {
    uploadDocument: createAsyncErrorWrapper(uploadDocument),
    getDocument: createAsyncErrorWrapper(getDocument),
    getDocuments: createAsyncErrorWrapper(getDocuments),
    updateDocument: createAsyncErrorWrapper(updateDocument),
    deleteDocument: createAsyncErrorWrapper(deleteDocument),
    getDocumentContent: createAsyncErrorWrapper(getDocumentContent),
  };
}

export { createDocumentHandlers }; 