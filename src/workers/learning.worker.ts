import { parentPort, workerData } from 'worker_threads';
import { createOpenRouterClient } from '../shared/utils/openrouter.js';
import { createLogger } from '../config/logger.js';
import { getEnvironmentConfig } from '../config/environment.js';
import { withResilience, createResilienceConfig } from '../shared/utils/resilience.js';

// Worker data structure
interface WorkerData {
  pdfBuffer: Buffer;
  fileName: string;
  userId: string;
}

const config = getEnvironmentConfig();
const logger = createLogger(config);

const openRouterClient = createOpenRouterClient({
  apiKey: config.OPENROUTER_API_KEY,
  siteUrl: config.SITE_URL,
  siteName: config.SITE_NAME,
}, logger);

const resilienceConfig = createResilienceConfig({
  retry: {
    retries: 3,
    factor: 2,
    minTimeout: 2000,
    maxTimeout: 30000,
    randomize: true,
  },
  circuitBreaker: {
    timeout: 120000, // 2 minutes for AI processing
    errorThresholdPercentage: 50,
    resetTimeout: 60000,
    minimumHalfOpenRequests: 1,
    name: 'ai-processing',
  },
  deadLetterQueue: {
    enabled: false,
    maxRetries: 3,
  },
});

const resilientAIProcessing = withResilience(
  async (bufferData: Buffer, name: string) => {
    logger.info({ fileName: name, size: bufferData.length }, 'Sending PDF to OpenRouter for processing');
    return openRouterClient.generateLearningModuleFromPDF(bufferData, name);
  },
  resilienceConfig,
  logger
);

async function processDocument() {
  try {
    const { pdfBuffer, fileName, userId } = workerData as WorkerData;
    
    logger.info({ 
      fileName, 
      userId, 
      bufferSize: pdfBuffer.length 
    }, 'Worker starting PDF processing');

    // Convert the buffer from array to Buffer if needed
    const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);

    // Perform AI processing with resilience wrappers
    const result = await resilientAIProcessing('generate-learning-module', buffer, fileName);

    if (!result.success) {
      throw result.error || new Error('AI processing failed after retries');
    }

    const content = result.data;

    // Validate structure and counts
    if (!content || !content.title || !content.summary || !content.flashcards || !content.assessment || !content.evaluation) {
      throw new Error('Invalid AI response structure - missing required fields');
    }

    if (content.flashcards.length !== 10) {
      throw new Error(`Expected 10 flashcards, got ${content.flashcards.length}`);
    }

    if (content.assessment.length !== 10) {
      throw new Error(`Expected 10 assessment questions, got ${content.assessment.length}`);
    }

    if (content.evaluation.length !== 10) {
      throw new Error(`Expected 10 evaluation questions, got ${content.evaluation.length}`);
    }

    logger.info({ fileName, userId, title: content.title }, 'AI processing completed successfully');

    parentPort?.postMessage({ content });
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Worker failed to process PDF');
    
    parentPort?.postMessage({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info({}, 'Worker received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info({}, 'Worker received SIGINT, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error({ error: error.message }, 'Uncaught exception in worker');
  parentPort?.postMessage({
    success: false,
    error: error.message,
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection in worker');
  parentPort?.postMessage({
    success: false,
    error: reason instanceof Error ? reason.message : 'Unhandled promise rejection',
  });
  process.exit(1);
});

// Start processing
processDocument(); 