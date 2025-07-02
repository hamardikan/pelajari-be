import { eq, and, ilike, sql, desc, asc } from 'drizzle-orm';
import type { Database } from '../config/database.js';
import type { Logger } from 'pino';
import { documents } from '../db/schema.js';
import type { DocumentData } from '../db/schema.js';
import type { DocumentsQuery } from './documents.schemas.js';

export type DocumentRecord = {
  id: string;
  data: DocumentData;
  createdAt: Date;
  updatedAt: Date;
};

export type DocumentRepository = {
  createDocument: (documentData: DocumentData) => Promise<DocumentRecord>;
  getDocumentById: (id: string) => Promise<DocumentRecord | null>;
  getDocuments: (options: DocumentsQuery) => Promise<{
    documents: DocumentRecord[];
    total: number;
    page: number;
    limit: number;
  }>;
  updateDocument: (id: string, documentData: Partial<DocumentData>) => Promise<DocumentRecord>;
  deleteDocument: (id: string) => Promise<void>;
  updateDocumentUsage: (id: string, usageType: string, referenceId: string) => Promise<void>;
  getDocumentsByUsage: (usageType: string, referenceId: string) => Promise<DocumentRecord[]>;
};

export function createDocumentRepository(db: Database, logger: Logger): DocumentRepository {
  
  async function createDocument(documentData: DocumentData): Promise<DocumentRecord> {
    try {
      logger.debug({ documentData }, 'Creating new document in database');
      
      const [newDocument] = await db
        .insert(documents)
        .values({ data: documentData })
        .returning();
      
      if (!newDocument) {
        throw new Error('Failed to create document');
      }
      
      logger.info({ documentId: newDocument.id }, 'Document created successfully');
      return newDocument as DocumentRecord;
    } catch (error) {
      logger.error({ error, documentData }, 'Failed to create document');
      throw error;
    }
  }
  
  async function getDocumentById(id: string): Promise<DocumentRecord | null> {
    try {
      logger.debug({ documentId: id }, 'Retrieving document by ID');
      
      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, id))
        .limit(1);
      
      return document ? (document as DocumentRecord) : null;
    } catch (error) {
      logger.error({ error, documentId: id }, 'Failed to retrieve document');
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
      
      const offset = (options.page - 1) * options.limit;
      let whereConditions: any[] = [];
      
      // Apply search filter
      if (options.search) {
        whereConditions.push(
          ilike(sql`${documents.data}->>'title'`, `%${options.search}%`)
        );
      }
      
      // Apply file type filter
      if (options.fileType) {
        whereConditions.push(
          eq(sql`${documents.data}->>'fileType'`, options.fileType)
        );
      }
      
      // Apply uploaded by filter
      if (options.uploadedBy) {
        whereConditions.push(
          eq(sql`${documents.data}->>'uploadedBy'`, options.uploadedBy)
        );
      }
      
      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
      
      // Get total count
      const countResult = await db
        .select({ count: sql`count(*)`.mapWith(Number) })
        .from(documents)
        .where(whereClause);
      
      const count = countResult[0]?.count ?? 0;
      
      // Get documents
      const documentResults = await db
        .select()
        .from(documents)
        .where(whereClause)
        .orderBy(desc(documents.createdAt))
        .limit(options.limit)
        .offset(offset);
      
      logger.info({ 
        totalDocuments: count, 
        returnedDocuments: documentResults.length,
        page: options.page,
        limit: options.limit 
      }, 'Documents retrieved successfully');
      
      return {
        documents: documentResults as DocumentRecord[],
        total: count,
        page: options.page,
        limit: options.limit,
      };
    } catch (error) {
      logger.error({ error, options }, 'Failed to retrieve documents');
      throw error;
    }
  }
  
  async function updateDocument(id: string, documentData: Partial<DocumentData>): Promise<DocumentRecord> {
    try {
      logger.debug({ documentId: id, documentData }, 'Updating document');
      
      // Get existing document first
      const existing = await getDocumentById(id);
      if (!existing) {
        throw new Error(`Document with ID ${id} not found`);
      }
      
      // Merge the updates with existing data
      const updatedData = { ...existing.data, ...documentData };
      
      const [updatedDocument] = await db
        .update(documents)
        .set({ 
          data: updatedData,
          updatedAt: new Date()
        })
        .where(eq(documents.id, id))
        .returning();
      
      if (!updatedDocument) {
        throw new Error(`Failed to update document with ID ${id}`);
      }
      
      logger.info({ documentId: id }, 'Document updated successfully');
      return updatedDocument as DocumentRecord;
    } catch (error) {
      logger.error({ error, documentId: id }, 'Failed to update document');
      throw error;
    }
  }
  
  async function deleteDocument(id: string): Promise<void> {
    try {
      logger.debug({ documentId: id }, 'Deleting document');
      
      await db
        .delete(documents)
        .where(eq(documents.id, id));
      
      logger.info({ documentId: id }, 'Document deleted successfully');
    } catch (error) {
      logger.error({ error, documentId: id }, 'Failed to delete document');
      throw error;
    }
  }
  
  async function updateDocumentUsage(id: string, usageType: string, referenceId: string): Promise<void> {
    try {
      logger.debug({ documentId: id, usageType, referenceId }, 'Updating document usage');
      
      const existing = await getDocumentById(id);
      if (!existing) {
        throw new Error(`Document with ID ${id} not found`);
      }
      
      const updatedData = { ...existing.data };
      
      // Update the appropriate usage array
      switch (usageType) {
        case 'learning_module':
          if (!updatedData.usage.learningModulesGenerated.includes(referenceId)) {
            updatedData.usage.learningModulesGenerated.push(referenceId);
          }
          break;
        case 'development_program':
          if (!updatedData.usage.developmentProgramsReferenced.includes(referenceId)) {
            updatedData.usage.developmentProgramsReferenced.push(referenceId);
          }
          break;
        case 'idp_analysis':
          if (!updatedData.usage.idpAnalysisUsed.includes(referenceId)) {
            updatedData.usage.idpAnalysisUsed.push(referenceId);
          }
          break;
        default:
          throw new Error(`Unknown usage type: ${usageType}`);
      }
      
      await db
        .update(documents)
        .set({ 
          data: updatedData,
          updatedAt: new Date()
        })
        .where(eq(documents.id, id));
      
      logger.info({ documentId: id, usageType, referenceId }, 'Document usage updated successfully');
    } catch (error) {
      logger.error({ error, documentId: id, usageType, referenceId }, 'Failed to update document usage');
      throw error;
    }
  }
  
  async function getDocumentsByUsage(usageType: string, referenceId: string): Promise<DocumentRecord[]> {
    try {
      logger.debug({ usageType, referenceId }, 'Retrieving documents by usage');
      
      let jsonPath: string;
      switch (usageType) {
        case 'learning_module':
          jsonPath = 'usage.learningModulesGenerated';
          break;
        case 'development_program':
          jsonPath = 'usage.developmentProgramsReferenced';
          break;
        case 'idp_analysis':
          jsonPath = 'usage.idpAnalysisUsed';
          break;
        default:
          throw new Error(`Unknown usage type: ${usageType}`);
      }
      
      const documentResults = await db
        .select()
        .from(documents)
        .where(sql`${documents.data}#>'{${jsonPath}}' ? ${referenceId}`)
        .orderBy(desc(documents.createdAt));
      
      logger.info({ 
        usageType, 
        referenceId, 
        foundDocuments: documentResults.length 
      }, 'Documents retrieved by usage');
      
      return documentResults as DocumentRecord[];
    } catch (error) {
      logger.error({ error, usageType, referenceId }, 'Failed to retrieve documents by usage');
      throw error;
    }
  }
  
  return {
    createDocument,
    getDocumentById,
    getDocuments,
    updateDocument,
    deleteDocument,
    updateDocumentUsage,
    getDocumentsByUsage,
  };
} 