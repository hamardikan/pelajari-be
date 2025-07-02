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