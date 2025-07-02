import type { Request, Response, NextFunction } from 'express';
import { z, type ZodSchema, type ZodError } from 'zod';

export type ValidationTarget = 'body' | 'params' | 'query' | 'headers';

export type ValidationError = {
  field: string;
  message: string;
  code: string;
};

export type ValidationResult = {
  success: boolean;
  data?: unknown;
  errors?: ValidationError[];
};

function formatZodErrors(error: ZodError): ValidationError[] {
  return error.errors.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

function createValidationMiddleware(
  schema: ZodSchema,
  target: ValidationTarget = 'body'
) {
  return function validationMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    try {
      let dataToValidate: unknown;
      
      switch (target) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'headers':
          dataToValidate = req.headers;
          break;
        default:
          dataToValidate = req.body;
      }

      const result = schema.safeParse(dataToValidate);
      
      if (!result.success) {
        const validationErrors = formatZodErrors(result.error);
        
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors,
        });
        return;
      }

      // Replace the original data with validated data
      switch (target) {
        case 'body':
          req.body = result.data;
          break;
        case 'params':
          req.params = result.data as Record<string, string>;
          break;
        case 'query':
          req.query = result.data as any;
          break;
        case 'headers':
          // Don't replace headers, just validate
          break;
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal validation error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

function validateBody(schema: ZodSchema) {
  return createValidationMiddleware(schema, 'body');
}

function validateParams(schema: ZodSchema) {
  return createValidationMiddleware(schema, 'params');
}

function validateQuery(schema: ZodSchema) {
  return createValidationMiddleware(schema, 'query');
}

function validateHeaders(schema: ZodSchema) {
  return createValidationMiddleware(schema, 'headers');
}

function createMultiValidationMiddleware(validations: Array<{
  schema: ZodSchema;
  target: ValidationTarget;
}>) {
  return function multiValidationMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const allErrors: ValidationError[] = [];
    
    for (const validation of validations) {
      let dataToValidate: unknown;
      
      switch (validation.target) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'headers':
          dataToValidate = req.headers;
          break;
        default:
          dataToValidate = req.body;
      }

      const result = validation.schema.safeParse(dataToValidate);
      
      if (!result.success) {
        const errors = formatZodErrors(result.error).map(error => ({
          ...error,
          field: `${validation.target}.${error.field}`,
        }));
        allErrors.push(...errors);
      } else {
        // Update request with validated data
        switch (validation.target) {
          case 'body':
            req.body = result.data;
            break;
          case 'params':
            req.params = result.data as Record<string, string>;
            break;
          case 'query':
            req.query = result.data as any;
            break;
        }
      }
    }
    
    if (allErrors.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: allErrors,
      });
      return;
    }
    
    next();
  };
}

function validateConditionally(
  condition: (req: Request) => boolean,
  schema: ZodSchema,
  target: ValidationTarget = 'body'
) {
  return function conditionalValidationMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    if (!condition(req)) {
      next();
      return;
    }
    
    const validationMiddleware = createValidationMiddleware(schema, target);
    validationMiddleware(req, res, next);
  };
}

function createCustomValidator<T>(
  validatorFn: (data: unknown) => ValidationResult & { data?: T }
) {
  return function customValidationMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const result = validatorFn(req.body);
    
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: 'Custom validation failed',
        errors: result.errors || [],
      });
      return;
    }
    
    if (result.data) {
      req.body = result.data;
    }
    
    next();
  };
}

// Common validation schemas
const commonSchemas = {
  pagination: z.object({
    page: z.string().transform(Number).refine(n => n > 0, 'Page must be positive').default('1'),
    limit: z.string().transform(Number).refine(n => n > 0 && n <= 100, 'Limit must be between 1-100').default('10'),
  }),
  
  uuid: z.string().uuid('Invalid UUID format'),
  
  email: z.string().email('Invalid email format'),
  
  password: z.string().min(8, 'Password must be at least 8 characters'),
  
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
};

export {
  createValidationMiddleware,
  validateBody,
  validateParams,
  validateQuery,
  validateHeaders,
  createMultiValidationMiddleware,
  validateConditionally,
  createCustomValidator,
  formatZodErrors,
  commonSchemas,
}; 