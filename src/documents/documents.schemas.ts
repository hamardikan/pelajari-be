import { z } from 'zod';

export const createDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).max(10).optional().default([]),
});

export const documentIdParamsSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).max(10).optional(),
});

export const documentsQuerySchema = z.object({
  page: z.string().transform(Number).refine(n => n > 0).default('1'),
  limit: z.string().transform(Number).refine(n => n > 0 && n <= 50).default('10'),
  search: z.string().optional(),
  fileType: z.enum(['pdf', 'docx', 'txt', 'pptx']).optional(),
  uploadedBy: z.string().uuid().optional(),
});

// Type exports
export type CreateDocumentData = z.infer<typeof createDocumentSchema>;
export type DocumentIdParams = z.infer<typeof documentIdParamsSchema>;
export type UpdateDocumentData = z.infer<typeof updateDocumentSchema>;
export type DocumentsQuery = z.infer<typeof documentsQuerySchema>; 