import type { Logger } from 'pino';
import type { DocumentRepository, DocumentRecord } from './documents.repositories.js';
import type { R2Client } from '../shared/utils/r2.js';
import type { CreateDocumentData, UpdateDocumentData, DocumentsQuery } from './documents.schemas.js';
import type { DocumentData } from '../db/schema.js';
import { createNotFoundError, createBusinessLogicError } from '../shared/middleware/error.middleware.js';

export type FileUploadData = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export type DocumentService = {
  uploadDocument: (userId: string, file: FileUploadData, metadata: CreateDocumentData) => Promise<DocumentRecord>;
  getDocument: (documentId: string) => Promise<DocumentRecord>;
  getDocuments: (options: DocumentsQuery) => Promise<{
    documents: DocumentRecord[];
    total: number;
    page: number;
    limit: number;
  }>;
  updateDocument: (documentId: string, updateData: UpdateDocumentData) => Promise<DocumentRecord>;
  deleteDocument: (documentId: string) => Promise<void>;
  getDocumentContent: (documentId: string) => Promise<string>; // Get file URL or extracted text
  markDocumentUsed: (documentId: string, usageType: 'learning_module' | 'development_program' | 'idp_analysis', referenceId: string) => Promise<void>;
};

export function createDocumentService(
  documentRepository: DocumentRepository,
  r2Client: R2Client,
  logger: Logger
): DocumentService {
  
  async function uploadDocument(userId: string, file: FileUploadData, metadata: CreateDocumentData): Promise<DocumentRecord> {
    try {
      logger.info({ userId, fileName: file.originalname, fileSize: file.size }, 'Uploading document');
      
      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw createBusinessLogicError('File size exceeds maximum limit of 10MB');
      }
      
      // Validate file type
      const fileType = getFileTypeFromMimetype(file.mimetype);
      if (!fileType) {
        throw createBusinessLogicError('Unsupported file type. Only PDF, DOCX, TXT, and PPTX files are allowed');
      }
      
      // Generate unique filename to avoid conflicts
      const timestamp = Date.now();
      const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueFilename = `${timestamp}_${sanitizedOriginalName}`;
      
      // Upload file to R2
      logger.debug({ userId, fileName: uniqueFilename }, 'Uploading file to R2 storage');
      const storagePath = await r2Client.uploadFile(file.buffer, uniqueFilename, file.mimetype);
      
      // Create document data
      const documentData: DocumentData = {
        title: metadata.title,
        originalFilename: file.originalname,
        storagePath,
        fileType,
        uploadedBy: userId,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        metadata: {
          processingStatus: 'pending',
          tags: metadata.tags || [],
          description: metadata.description,
        },
        usage: {
          learningModulesGenerated: [],
          developmentProgramsReferenced: [],
          idpAnalysisUsed: [],
        },
      };
      
      const newDocument = await documentRepository.createDocument(documentData);
      logger.info({ documentId: newDocument.id, userId }, 'Document uploaded successfully');
      
      return newDocument;
    } catch (error) {
      logger.error({ error, userId, fileName: file.originalname }, 'Failed to upload document');
      throw error;
    }
  }
  
  async function getDocument(documentId: string): Promise<DocumentRecord> {
    try {
      logger.debug({ documentId }, 'Retrieving document');
      
      const document = await documentRepository.getDocumentById(documentId);
      if (!document) {
        throw createNotFoundError(`Document with ID ${documentId} not found`);
      }
      
      return document;
    } catch (error) {
      logger.error({ error, documentId }, 'Failed to retrieve document');
      throw error;
    }
  }
  
  async function getDocuments(options: DocumentsQuery): Promise<{
    documents: DocumentRecord[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      logger.debug({ options }, 'Retrieving documents with filters');
      
      const result = await documentRepository.getDocuments(options);
      
      logger.info({ 
        totalDocuments: result.total, 
        returnedDocuments: result.documents.length,
        page: result.page,
        limit: result.limit 
      }, 'Documents retrieved successfully');
      
      return result;
    } catch (error) {
      logger.error({ error, options }, 'Failed to retrieve documents');
      throw error;
    }
  }
  
  async function updateDocument(documentId: string, updateData: UpdateDocumentData): Promise<DocumentRecord> {
    try {
      logger.debug({ documentId, updateData }, 'Updating document');
      
      // Check if document exists
      const existingDocument = await documentRepository.getDocumentById(documentId);
      if (!existingDocument) {
        throw createNotFoundError(`Document with ID ${documentId} not found`);
      }
      
      // Prepare updated metadata
      const updatedMetadata = { ...existingDocument.data.metadata };
      if (updateData.description !== undefined) {
        updatedMetadata.description = updateData.description;
      }
      if (updateData.tags !== undefined) {
        updatedMetadata.tags = updateData.tags;
      }
      
      // Prepare update data
      const documentUpdateData: Partial<DocumentData> = {};
      if (updateData.title !== undefined) {
        documentUpdateData.title = updateData.title;
      }
      if (Object.keys(updatedMetadata).length > 0) {
        documentUpdateData.metadata = updatedMetadata;
      }
      
      const updatedDocument = await documentRepository.updateDocument(documentId, documentUpdateData);
      
      logger.info({ documentId }, 'Document updated successfully');
      return updatedDocument;
    } catch (error) {
      logger.error({ error, documentId }, 'Failed to update document');
      throw error;
    }
  }
  
  async function deleteDocument(documentId: string): Promise<void> {
    try {
      logger.debug({ documentId }, 'Deleting document');
      
      // Check if document exists and get file path for cleanup
      const document = await documentRepository.getDocumentById(documentId);
      if (!document) {
        throw createNotFoundError(`Document with ID ${documentId} not found`);
      }
      
      // Check if document is being used
      const isUsed = document.data.usage.learningModulesGenerated.length > 0 ||
                    document.data.usage.developmentProgramsReferenced.length > 0 ||
                    document.data.usage.idpAnalysisUsed.length > 0;
      
      if (isUsed) {
        throw createBusinessLogicError('Cannot delete document that is being used by learning modules, development programs, or IDP analyses');
      }
      
      // Delete from database first
      await documentRepository.deleteDocument(documentId);
      
      // Try to delete from R2 storage (non-blocking, log errors but don't fail)
      try {
        await r2Client.deleteFile(document.data.storagePath);
        logger.info({ documentId, storagePath: document.data.storagePath }, 'Document file deleted from storage');
      } catch (storageError) {
        logger.warn({ 
          documentId, 
          storagePath: document.data.storagePath, 
          error: storageError 
        }, 'Failed to delete document file from storage (database record removed)');
      }
      
      logger.info({ documentId }, 'Document deleted successfully');
    } catch (error) {
      logger.error({ error, documentId }, 'Failed to delete document');
      throw error;
    }
  }
  
  async function getDocumentContent(documentId: string): Promise<string> {
    try {
      logger.debug({ documentId }, 'Getting document content');
      
      const document = await documentRepository.getDocumentById(documentId);
      if (!document) {
        throw createNotFoundError(`Document with ID ${documentId} not found`);
      }
      
      // If we have cached extracted text, return it
      if (document.data.metadata.extractedText) {
        logger.debug({ documentId }, 'Returning cached extracted text');
        return document.data.metadata.extractedText;
      }
      
      // Otherwise, generate a signed URL for download
      logger.debug({ documentId }, 'Generating signed URL for document download');
      const signedUrl = await r2Client.getFileUrl(document.data.storagePath);
      
      return signedUrl;
    } catch (error) {
      logger.error({ error, documentId }, 'Failed to get document content');
      throw error;
    }
  }
  
  async function markDocumentUsed(
    documentId: string, 
    usageType: 'learning_module' | 'development_program' | 'idp_analysis', 
    referenceId: string
  ): Promise<void> {
    try {
      logger.debug({ documentId, usageType, referenceId }, 'Marking document as used');
      
      await documentRepository.updateDocumentUsage(documentId, usageType, referenceId);
      
      logger.info({ documentId, usageType, referenceId }, 'Document usage marked successfully');
    } catch (error) {
      logger.error({ error, documentId, usageType, referenceId }, 'Failed to mark document usage');
      throw error;
    }
  }
  
  return {
    uploadDocument,
    getDocument,
    getDocuments,
    updateDocument,
    deleteDocument,
    getDocumentContent,
    markDocumentUsed,
  };
}

function getFileTypeFromMimetype(mimetype: string): 'pdf' | 'docx' | 'txt' | 'pptx' | null {
  const mimeTypeMap: Record<string, 'pdf' | 'docx' | 'txt' | 'pptx'> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-word': 'docx', // For older .doc files
    'text/plain': 'txt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.ms-powerpoint': 'pptx', // For older .ppt files
  };
  
  return mimeTypeMap[mimetype] || null;
} 