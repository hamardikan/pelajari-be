import pino from 'pino';
import type { Logger } from 'pino';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import type { EnvironmentConfig } from './environment.js';

export type LoggerConfig = Pick<EnvironmentConfig, 'LOG_LEVEL' | 'NODE_ENV'>;

export interface RequestWithCorrelation extends Request {
  correlationId?: string;
}

function createLogger(config: LoggerConfig): Logger {
  const loggerOptions: pino.LoggerOptions = {
    level: config.LOG_LEVEL,
    ...(config.NODE_ENV === 'development' && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'yyyy-mm-dd HH:MM:ss',
        },
      },
    }),
    ...(config.NODE_ENV === 'production' && {
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    }),
  };

  return pino(loggerOptions);
}

function createChildLogger(parentLogger: Logger, context: Record<string, unknown>): Logger {
  return parentLogger.child(context);
}

function addCorrelationId() {
  return function correlationMiddleware(
    req: RequestWithCorrelation,
    res: Response,
    next: NextFunction
  ): void {
    // Generate or extract correlation ID
    const correlationId = 
      req.headers['x-correlation-id'] as string ||
      req.headers['x-request-id'] as string ||
      randomUUID();

    // Add to request object
    req.correlationId = correlationId;

    // Add to response headers
    res.setHeader('x-correlation-id', correlationId);

    next();
  };
}

function createRequestLogger(logger: Logger) {
  return function requestLoggingMiddleware(
    req: RequestWithCorrelation,
    res: Response,
    next: NextFunction
  ): void {
    const startTime = Date.now();
    
    const requestLogger = createChildLogger(logger, {
      correlationId: req.correlationId,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
    });

    // Log incoming request
    requestLogger.info('Incoming request');

    // Log response after it's finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      requestLogger.info({
        statusCode: res.statusCode,
        duration,
      }, 'Request completed');
    });

    next();
  };
}

function createErrorLogger(logger: Logger) {
  return function errorLoggingMiddleware(
    error: Error,
    req: RequestWithCorrelation,
    res: Response,
    next: NextFunction
  ): void {
    const errorLogger = createChildLogger(logger, {
      correlationId: req.correlationId,
      method: req.method,
      url: req.url,
    });

    errorLogger.error({
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    }, 'Request error');

    next(error);
  };
}

function createStructuredLogger(logger: Logger, context: Record<string, unknown>) {
  return function logMessage(level: pino.Level, message: string, data?: Record<string, unknown>): void {
    const logData = { ...context, ...data };
    logger[level](logData, message);
  };
}

function createHealthCheckLogger(logger: Logger) {
  return function logHealthCheck(component: string, status: 'healthy' | 'unhealthy', error?: Error): void {
    const healthLogger = createChildLogger(logger, { component });
    
    if (status === 'healthy') {
      healthLogger.info('Health check passed');
    } else {
      healthLogger.error({ error: error?.message }, 'Health check failed');
    }
  };
}

export {
  createLogger,
  createChildLogger,
  addCorrelationId,
  createRequestLogger,
  createErrorLogger,
  createStructuredLogger,
  createHealthCheckLogger,
}; 