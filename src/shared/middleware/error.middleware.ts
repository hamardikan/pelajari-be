import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import type { RequestWithCorrelation } from '../../config/logger.js';

export type ErrorType = 
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'BUSINESS_LOGIC_ERROR'
  | 'DATABASE_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'INTERNAL_SERVER_ERROR';

export type ErrorClassification = {
  type: ErrorType;
  statusCode: number;
  isOperational: boolean;
  shouldLog: boolean;
  shouldExpose: boolean;
};

export type StandardErrorResponse = {
  success: false;
  message: string;
  error?: {
    type: string;
    details?: unknown;
  };
  correlationId?: string;
  timestamp: string;
};

function classifyError(error: Error): ErrorClassification {
  // Check for specific error types based on error name, message, or custom properties
  if (error.name === 'ValidationError' || error.message.includes('validation')) {
    return {
      type: 'VALIDATION_ERROR',
      statusCode: 400,
      isOperational: true,
      shouldLog: false,
      shouldExpose: true,
    };
  }

  if (error.name === 'UnauthorizedError' || error.message.includes('unauthorized')) {
    return {
      type: 'AUTHENTICATION_ERROR',
      statusCode: 401,
      isOperational: true,
      shouldLog: true,
      shouldExpose: true,
    };
  }

  if (error.name === 'ForbiddenError' || error.message.includes('forbidden')) {
    return {
      type: 'AUTHORIZATION_ERROR',
      statusCode: 403,
      isOperational: true,
      shouldLog: true,
      shouldExpose: true,
    };
  }

  if (error.name === 'NotFoundError' || error.message.includes('not found')) {
    return {
      type: 'NOT_FOUND_ERROR',
      statusCode: 404,
      isOperational: true,
      shouldLog: false,
      shouldExpose: true,
    };
  }

  if (error.name === 'BusinessLogicError') {
    return {
      type: 'BUSINESS_LOGIC_ERROR',
      statusCode: 422,
      isOperational: true,
      shouldLog: true,
      shouldExpose: true,
    };
  }

  if (error.name === 'DatabaseError' || error.message.includes('database')) {
    return {
      type: 'DATABASE_ERROR',
      statusCode: 500,
      isOperational: true,
      shouldLog: true,
      shouldExpose: false,
    };
  }

  if (error.name === 'ExternalServiceError') {
    return {
      type: 'EXTERNAL_SERVICE_ERROR',
      statusCode: 502,
      isOperational: true,
      shouldLog: true,
      shouldExpose: false,
    };
  }

  // Default to internal server error
  return {
    type: 'INTERNAL_SERVER_ERROR',
    statusCode: 500,
    isOperational: false,
    shouldLog: true,
    shouldExpose: false,
  };
}

function formatErrorResponse(
  error: Error,
  classification: ErrorClassification,
  isDevelopment: boolean,
  correlationId?: string
): StandardErrorResponse {
  const baseResponse: StandardErrorResponse = {
    success: false,
    message: classification.shouldExpose ? error.message : 'An internal error occurred',
    correlationId,
    timestamp: new Date().toISOString(),
  };

  if (classification.shouldExpose || isDevelopment) {
    baseResponse.error = {
      type: classification.type,
      details: isDevelopment ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };
  }

  return baseResponse;
}

function createErrorHandler(logger: Logger, isDevelopment: boolean = false) {
  return function errorHandler(
    error: Error,
    req: RequestWithCorrelation,
    res: Response,
    next: NextFunction
  ): void {
    const correlationId = req.correlationId;
    const classification = classifyError(error);
    
    // Log error if needed
    if (classification.shouldLog) {
      const errorLogger = logger.child({
        correlationId,
        errorType: classification.type,
        url: req.url,
        method: req.method,
        userAgent: req.headers['user-agent'],
      });

      if (classification.isOperational) {
        errorLogger.warn({
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }, 'Operational error occurred');
      } else {
        errorLogger.error({
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }, 'Non-operational error occurred');
      }
    }

    // Format and send error response
    const errorResponse = formatErrorResponse(
      error,
      classification,
      isDevelopment,
      correlationId
    );

    res.status(classification.statusCode).json(errorResponse);

    // If this is a non-operational error, we might want to restart the process
    if (!classification.isOperational) {
      logger.fatal({
        correlationId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }, 'Non-operational error - application may be unstable');
    }
  };
}

function createNotFoundHandler() {
  return function notFoundHandler(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const error = new Error(`Route not found: ${req.method} ${req.path}`);
    error.name = 'NotFoundError';
    next(error);
  };
}

function createAsyncErrorWrapper(
  asyncFunction: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return function wrappedAsyncFunction(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    Promise.resolve(asyncFunction(req, res, next))
      .catch(next);
  };
}

// Custom error classes for better error handling
class ValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends Error {
  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

class NotFoundError extends Error {
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

class BusinessLogicError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'BusinessLogicError';
  }
}

class DatabaseError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

class ExternalServiceError extends Error {
  constructor(message: string, public service?: string, public originalError?: Error) {
    super(message);
    this.name = 'ExternalServiceError';
  }
}

// Error factory functions
function createValidationError(message: string, details?: unknown): ValidationError {
  return new ValidationError(message, details);
}

function createUnauthorizedError(message?: string): UnauthorizedError {
  return new UnauthorizedError(message);
}

function createForbiddenError(message?: string): ForbiddenError {
  return new ForbiddenError(message);
}

function createNotFoundError(message?: string): NotFoundError {
  return new NotFoundError(message);
}

function createBusinessLogicError(message: string, code?: string): BusinessLogicError {
  return new BusinessLogicError(message, code);
}

function createDatabaseError(message: string, originalError?: Error): DatabaseError {
  return new DatabaseError(message, originalError);
}

function createExternalServiceError(
  message: string,
  service?: string,
  originalError?: Error
): ExternalServiceError {
  return new ExternalServiceError(message, service, originalError);
}

export {
  createErrorHandler,
  createNotFoundHandler,
  createAsyncErrorWrapper,
  classifyError,
  formatErrorResponse,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BusinessLogicError,
  DatabaseError,
  ExternalServiceError,
  createValidationError,
  createUnauthorizedError,
  createForbiddenError,
  createNotFoundError,
  createBusinessLogicError,
  createDatabaseError,
  createExternalServiceError,
}; 