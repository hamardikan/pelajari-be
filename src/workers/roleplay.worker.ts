import { parentPort, workerData } from 'worker_threads';
import OpenAI from 'openai';
import { createLogger } from '../config/logger.js';
import { getEnvironmentConfig } from '../config/environment.js';
import { withResilience, createResilienceConfig } from '../shared/utils/resilience.js';

// Worker data structures for different roleplay tasks
interface InitialMessageWorkerData {
  type: 'initial-message';
  sessionId: string;
  scenario: any;
  userId: string;
}

interface ConversationWorkerData {
  type: 'conversation';
  sessionId: string;
  scenario: any;
  conversationHistory: Array<{
    id: string;
    timestamp: string;
    sender: 'user' | 'ai';
    content: string;
  }>;
  userId: string;
}

interface EvaluationWorkerData {
  type: 'evaluation';
  sessionId: string;
  scenario: any;
  conversationHistory: Array<{
    id: string;
    timestamp: string;
    sender: 'user' | 'ai';
    content: string;
  }>;
  duration: number;
  userId: string;
}

type WorkerData = InitialMessageWorkerData | ConversationWorkerData | EvaluationWorkerData;

const config = getEnvironmentConfig();
const logger = createLogger(config);

// Create OpenAI client
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: config.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": config.SITE_URL || "http://localhost:3000",
    "X-Title": config.SITE_NAME || "Pelajari App",
  },
});

// Resilience configuration for AI processing
const resilienceConfig = createResilienceConfig({
  retry: {
    retries: 3,
    factor: 1.5,
    minTimeout: 1000,
    maxTimeout: 15000,
    randomize: true,
  },
  circuitBreaker: {
    timeout: 120000, // 2 minutes for roleplay AI processing
    errorThresholdPercentage: 60,
    resetTimeout: 60000,
    minimumHalfOpenRequests: 1,
    name: 'roleplay-ai-processing',
  },
  deadLetterQueue: {
    enabled: false,
    maxRetries: 3,
  },
});

const resilientAIProcessing = withResilience(
  async (messages: any[], temperature: number = 0.7) => {
    logger.info({ task: 'roleplay-ai-request' }, 'Sending roleplay request to OpenRouter');

    const completion = await openai.chat.completions.create({
      model: "google/gemini-2.5-flash",
      messages,
      temperature,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content returned from OpenRouter');
    }

    return content;
  },
  resilienceConfig,
  logger
);

// Enhanced JSON parsing for evaluation results
function parseAIResponse(content: string): any {
  try {
    return JSON.parse(content);
  } catch (firstError: any) {
    try {
      const cleanedContent = content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      return JSON.parse(cleanedContent);
    } catch (secondError: any) {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('No valid JSON found in response');
      } catch (thirdError: any) {
        logger.error({ 
          content: content.substring(0, 500),
          firstError: firstError && firstError.message ? firstError.message : String(firstError),
        }, 'All JSON parsing attempts failed');
        throw new Error(`Failed to parse AI response: ${firstError && firstError.message ? firstError.message : String(firstError)}`);
      }
    }
  }
}

// Generate initial AI message to welcome user to roleplay
async function processInitialMessage(data: InitialMessageWorkerData) {
  const { scenario } = data;
  
  try {
    logger.info({ 
      sessionId: data.sessionId,
      scenarioTitle: scenario.title 
    }, 'Generating initial roleplay message');

    const messages = [
      {
        role: 'system',
        content: `${scenario.systemPrompt}

SCENARIO CONTEXT: ${scenario.scenario.context}
SETTING: ${scenario.scenario.setting}
YOUR ROLE: ${scenario.scenario.aiRole}
USER'S ROLE: ${scenario.scenario.yourRole}

INSTRUCTIONS:
- Generate a natural opening message to start the roleplay
- Stay in character as ${scenario.scenario.aiRole}
- Set the scene and context naturally
- Be engaging and invite the user to respond
- Keep the message under 150 words
- Do not break character or mention this is an AI simulation`
      },
      {
        role: 'user',
        content: 'Start the roleplay scenario now. Generate your opening message as the character.'
      }
    ];

    const result = await resilientAIProcessing('initial-message', messages, 0.8);
    
    if (!result.success) {
      throw result.error || new Error('Initial message generation failed');
    }

    logger.info({ 
      sessionId: data.sessionId,
      scenarioTitle: scenario.title 
    }, 'Initial roleplay message generated successfully');

    return {
      initialMessage: result.data.trim()
    };
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionId: data.sessionId 
    }, 'Failed to generate initial roleplay message');
    throw error;
  }
}

// Process ongoing conversation in roleplay
async function processConversation(data: ConversationWorkerData) {
  const { scenario, conversationHistory } = data;
  
  try {
    logger.info({ 
      sessionId: data.sessionId,
      messageCount: conversationHistory.length 
    }, 'Processing roleplay conversation');

    // Build conversation context for AI
    const conversationText = conversationHistory
      .slice(-10) // Keep last 10 messages for context
      .map(msg => `${msg.sender.toUpperCase()}: ${msg.content}`)
      .join('\n');

    const messages = [
      {
        role: 'system',
        content: `${scenario.systemPrompt}

SCENARIO CONTEXT: ${scenario.scenario.context}
SETTING: ${scenario.scenario.setting}
YOUR ROLE: ${scenario.scenario.aiRole}
USER'S ROLE: ${scenario.scenario.yourRole}

CONVERSATION SO FAR:
${conversationText}

INSTRUCTIONS:
- Continue the roleplay naturally as ${scenario.scenario.aiRole}
- Respond to the user's latest message appropriately
- Stay in character throughout
- Keep responses under 200 words
- Drive the scenario forward meaningfully
- React authentically to what the user says and does`
      },
      {
        role: 'user',
        content: 'Continue the roleplay. Respond to my latest message naturally as the character.'
      }
    ];

    const result = await resilientAIProcessing('conversation', messages, 0.7);
    
    if (!result.success) {
      throw result.error || new Error('Conversation processing failed');
    }

    logger.info({ 
      sessionId: data.sessionId,
      messageCount: conversationHistory.length 
    }, 'Roleplay conversation processed successfully');

    return {
      aiResponse: result.data.trim()
    };
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionId: data.sessionId 
    }, 'Failed to process roleplay conversation');
    throw error;
  }
}

// Generate final evaluation of roleplay session
async function processEvaluation(data: EvaluationWorkerData) {
  const { scenario, conversationHistory, duration } = data;
  
  try {
    logger.info({ 
      sessionId: data.sessionId,
      messageCount: conversationHistory.length,
      duration 
    }, 'Generating roleplay session evaluation');

    // Build full conversation transcript
    const transcript = conversationHistory
      .map(msg => `${msg.sender.toUpperCase()}: ${msg.content}`)
      .join('\n');

    const evaluationCriteriaText = Object.entries(scenario.evaluationCriteria)
      .map(([category, criteria]) => `${category}: ${(criteria as string[]).join(', ')}`)
      .join('\n');

    const messages = [
      {
        role: 'system',
        content: `You are an expert roleplay evaluator. Analyze the following roleplay session and provide a comprehensive evaluation.

SCENARIO: ${scenario.title}
OBJECTIVES: ${scenario.scenario.objectives.join(', ')}
SUCCESS CRITERIA: ${scenario.scenario.successCriteria.join(', ')}
TARGET COMPETENCIES: ${scenario.targetCompetencies.join(', ')}

EVALUATION CRITERIA:
${evaluationCriteriaText}

FULL CONVERSATION TRANSCRIPT:
${transcript}

SESSION DURATION: ${duration} minutes

Provide evaluation in this exact JSON format:
{
  "overallScore": 0-100,
  "competencyScores": {
    "${scenario.targetCompetencies[0] || 'communication'}": 0-100,
    "${scenario.targetCompetencies[1] || 'problem-solving'}": 0-100,
    "${scenario.targetCompetencies[2] || 'professionalism'}": 0-100
  },
  "strengths": ["strength1", "strength2", "strength3"],
  "areasForImprovement": ["area1", "area2", "area3"],
  "detailedFeedback": "Comprehensive feedback paragraph",
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"]
}

Evaluate based on:
- How well objectives were met
- Quality of communication and responses
- Demonstration of target competencies
- Professional behavior and approach
- Problem-solving and adaptability`
      },
      {
        role: 'user',
        content: 'Evaluate this roleplay session. Return only the JSON evaluation.'
      }
    ];

    const result = await resilientAIProcessing('evaluation', messages, 0.3);
    
    if (!result.success) {
      throw result.error || new Error('Evaluation generation failed');
    }

    try {
      const evaluation = parseAIResponse(result.data);
      
      // Validate evaluation structure
      if (!evaluation.overallScore || !evaluation.competencyScores || 
          !evaluation.strengths || !evaluation.areasForImprovement ||
          !evaluation.detailedFeedback || !evaluation.recommendations) {
        throw new Error('Invalid evaluation response structure');
      }

      logger.info({ 
        sessionId: data.sessionId,
        overallScore: evaluation.overallScore,
        duration 
      }, 'Roleplay session evaluation generated successfully');

      return { evaluation };
    } catch (parseError: any) {
      logger.error({ 
        parseError: parseError && parseError.message ? parseError.message : String(parseError),
        response: result.data.substring(0, 500) + '...'
      }, 'Failed to parse evaluation JSON response');
      throw new Error(`Invalid JSON response from AI for evaluation: ${parseError && parseError.message ? parseError.message : String(parseError)}`);
    }
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionId: data.sessionId 
    }, 'Failed to generate roleplay evaluation');
    throw error;
  }
}

async function processRoleplayTask() {
  try {
    const data = workerData as WorkerData;
    
    logger.info({ 
      taskType: data.type,
      sessionId: data.sessionId 
    }, 'Worker starting roleplay task processing');

    let result;

    switch (data.type) {
      case 'initial-message':
        result = await processInitialMessage(data);
        break;
      case 'conversation':
        result = await processConversation(data);
        break;
      case 'evaluation':
        result = await processEvaluation(data);
        break;
      default:
        throw new Error(`Unknown roleplay task type: ${(data as any).type}`);
    }

    logger.info({ 
      taskType: data.type,
      sessionId: data.sessionId 
    }, 'Roleplay task processing completed successfully');

    parentPort?.postMessage({ success: true, data: result });
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      taskType: (workerData as WorkerData).type 
    }, 'Worker failed to process roleplay task');
    
    parentPort?.postMessage({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info({}, 'Roleplay Worker received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info({}, 'Roleplay Worker received SIGINT, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error({ error: error.message }, 'Uncaught exception in roleplay worker');
  parentPort?.postMessage({
    success: false,
    error: error.message,
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection in roleplay worker');
  parentPort?.postMessage({
    success: false,
    error: reason instanceof Error ? reason.message : 'Unhandled promise rejection',
  });
  process.exit(1);
});

// Start processing
processRoleplayTask(); 