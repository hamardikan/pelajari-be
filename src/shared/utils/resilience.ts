import pRetry, { type FailedAttemptError } from 'p-retry';
import CircuitBreaker from 'opossum';
import { eq } from 'drizzle-orm';
import type { Logger } from 'pino';
import type { Database } from '../../config/database.js';
import { deadLetterQueue } from '../../db/schema.js';
import type { DeadLetterQueueData } from '../../db/schema.js';

export type RetryOptions = {
  retries: number;
  factor: number;
  minTimeout: number;
  maxTimeout: number;
  randomize: boolean;
};

export type CircuitBreakerOptions = {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  minimumHalfOpenRequests: number;
  /** Minimum number of requests before error percentage is calculated. */
  volumeThreshold?: number;
  name: string;
};

export type ResilienceConfig = {
  retry: RetryOptions;
  circuitBreaker: CircuitBreakerOptions;
  deadLetterQueue: {
    enabled: boolean;
    maxRetries: number;
  };
};

export type OperationResult<T> = {
  success: boolean;
  data?: T;
  error?: Error;
};

function createRetryWithBackoff<T>(options: RetryOptions, logger: Logger) {
  return async function retryOperation(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const retryOptions = {
      retries: options.retries,
      factor: options.factor,
      minTimeout: options.minTimeout,
      maxTimeout: options.maxTimeout,
      randomize: options.randomize,
      onFailedAttempt: (error: FailedAttemptError) => {
        logger.warn({
          operationName,
          attempt: error.attemptNumber,
          retriesLeft: error.retriesLeft,
          error: error.message,
        }, 'Operation failed, retrying...');
      },
    };

    return pRetry(operation, retryOptions);
  };
}

function createCircuitBreaker<T extends unknown[], R>(
  options: CircuitBreakerOptions,
  logger: Logger
) {
  return function wrapWithCircuitBreaker(
    operation: (...args: T) => Promise<R>
  ): (...args: T) => Promise<R> {
    const breaker = new CircuitBreaker(operation, {
      timeout: options.timeout,
      errorThresholdPercentage: options.errorThresholdPercentage,
      resetTimeout: options.resetTimeout,
      volumeThreshold: options.volumeThreshold ?? 5,
      name: options.name,
    });

    // Set up event listeners for monitoring
    breaker.on('open', () => {
      logger.warn({ circuitBreaker: options.name }, 'Circuit breaker opened');
    });

    breaker.on('halfOpen', () => {
      logger.info({ circuitBreaker: options.name }, 'Circuit breaker half-opened');
    });

    breaker.on('close', () => {
      logger.info({ circuitBreaker: options.name }, 'Circuit breaker closed');
    });

    breaker.on('failure', (error: Error) => {
      logger.error({
        circuitBreaker: options.name,
        error: error.message,
      }, 'Circuit breaker failure occurred');
    });

    return breaker.fire.bind(breaker);
  };
}

function createDeadLetterQueue(db: Database, logger: Logger) {
  async function addToDeadLetterQueue(
    operation: string,
    payload: Record<string, unknown>,
    error: Error,
    maxRetries: number = 3
  ): Promise<void> {
    try {
      const dlqEntry: DeadLetterQueueData = {
        operation,
        payload,
        error: error.message,
        retryCount: 0,
        maxRetries,
        status: 'pending',
      };

      await db.insert(deadLetterQueue).values({
        data: dlqEntry,
      });

      logger.info({
        operation,
        error: error.message,
      }, 'Added failed operation to dead letter queue');
    } catch (dlqError) {
      logger.error({
        operation,
        error: error.message,
        dlqError: dlqError instanceof Error ? dlqError.message : 'Unknown error',
      }, 'Failed to add operation to dead letter queue');
    }
  }

  async function processDeadLetterQueue(
    operationHandlers: Record<string, (payload: Record<string, unknown>) => Promise<void>>
  ): Promise<void> {
    try {
      // Get pending items from dead letter queue
      const pendingItems = await db
        .select()
        .from(deadLetterQueue)
        .where(eq(deadLetterQueue.data, { status: 'pending' }));

      for (const item of pendingItems) {
        const dlqData = item.data as DeadLetterQueueData;
        const handler = operationHandlers[dlqData.operation];

        if (!handler) {
          logger.warn({
            operation: dlqData.operation,
          }, 'No handler found for dead letter queue operation');
          continue;
        }

        try {
          // Mark as processing
          await db
            .update(deadLetterQueue)
            .set({
              data: { ...dlqData, status: 'processing' },
              updatedAt: new Date(),
            })
            .where(eq(deadLetterQueue.id, item.id));

          // Execute the operation
          await handler(dlqData.payload);

          // Mark as success
          await db
            .update(deadLetterQueue)
            .set({
              data: { ...dlqData, status: 'success' },
              updatedAt: new Date(),
            })
            .where(eq(deadLetterQueue.id, item.id));

          logger.info({
            operation: dlqData.operation,
          }, 'Successfully processed dead letter queue item');
        } catch (processingError) {
          const newRetryCount = dlqData.retryCount + 1;
          const shouldFail = newRetryCount >= dlqData.maxRetries;

          await db
            .update(deadLetterQueue)
            .set({
              data: {
                ...dlqData,
                retryCount: newRetryCount,
                status: shouldFail ? 'failed' : 'pending',
                nextRetryAt: shouldFail ? undefined : new Date(Date.now() + Math.pow(2, newRetryCount) * 1000).toISOString(),
              },
              updatedAt: new Date(),
            })
            .where(eq(deadLetterQueue.id, item.id));

          logger.error({
            operation: dlqData.operation,
            retryCount: newRetryCount,
            maxRetries: dlqData.maxRetries,
            failed: shouldFail,
            error: processingError instanceof Error ? processingError.message : 'Unknown error',
          }, 'Failed to process dead letter queue item');
        }
      }
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to process dead letter queue');
    }
  }

  return {
    addToDeadLetterQueue,
    processDeadLetterQueue,
  };
}

function withResilience(
  operation: (...args: any[]) => Promise<any>,
  resilienceConfig: ResilienceConfig,
  logger: Logger,
  db?: Database
) {
  const retryWrapper = createRetryWithBackoff(resilienceConfig.retry, logger);
  const circuitBreakerWrapper = createCircuitBreaker(resilienceConfig.circuitBreaker, logger);
  const dlq = db ? createDeadLetterQueue(db, logger) : null;

  return async function resilientOperation(
    operationName: string,
    ...args: any[]
  ): Promise<OperationResult<any>> {
    try {
      // Wrap operation with circuit breaker
      const circuitBreakerOperation = circuitBreakerWrapper(operation);
      
      // Wrap with retry logic
      const result = await retryWrapper(
        () => circuitBreakerOperation(...args),
        operationName
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const operationError = error instanceof Error ? error : new Error('Unknown error');
      
      // Add to dead letter queue if enabled and available
      if (resilienceConfig.deadLetterQueue.enabled && dlq && args.length > 0) {
        await dlq.addToDeadLetterQueue(
          operationName,
          { args: args as unknown as Record<string, unknown> },
          operationError,
          resilienceConfig.deadLetterQueue.maxRetries
        );
      }

      return {
        success: false,
        error: operationError,
      };
    }
  };
}

function createResilienceConfig(options: Partial<ResilienceConfig> = {}): ResilienceConfig {
  return {
    retry: {
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 30000,
      randomize: true,
      ...options.retry,
    },
    circuitBreaker: {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      minimumHalfOpenRequests: 3,
      volumeThreshold: 5,
      name: 'default',
      ...options.circuitBreaker,
    },
    deadLetterQueue: {
      enabled: true,
      maxRetries: 3,
      ...options.deadLetterQueue,
    },
  };
}

export {
  createRetryWithBackoff,
  createCircuitBreaker,
  createDeadLetterQueue,
  withResilience,
  createResilienceConfig,
}; 