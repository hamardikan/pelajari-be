import { parentPort, workerData } from 'worker_threads';
import { createOpenRouterClient } from '../shared/utils/openrouter.js';
import { createLogger } from '../config/logger.js';
import { getEnvironmentConfig } from '../config/environment.js';

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

    const content = await openRouterClient.generateLearningModuleFromPDF(buffer, fileName);
    
    logger.info({ 
      fileName, 
      userId, 
      title: content.title,
      flashcardsCount: content.flashcards.length,
      assessmentCount: content.assessment.length,
      evaluationCount: content.evaluation.length
    }, 'Worker completed PDF processing successfully');
    
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