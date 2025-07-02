import OpenAI from 'openai';
import type { Logger } from 'pino';

export type OpenRouterConfig = {
  apiKey: string;
  baseURL?: string;
  siteUrl?: string;
  siteName?: string;
};

export type FlashcardData = {
  term: string;
  definition: string;
};

export type AssessmentQuestionData = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

export type EvaluationQuestionData = {
  scenario: string;
  question: string;
  sampleAnswer: string;
  evaluationCriteria: string[];
};

export type LearningModuleContent = {
  title: string;
  summary: string;
  flashcards: FlashcardData[];
  assessment: AssessmentQuestionData[];
  evaluation: EvaluationQuestionData[];
};

/**
 * Determines the MIME type for a given file name.
 * @param {string} fileName - The name of the file.
 * @returns {string} The corresponding MIME type.
 */
function getMimeType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'json':
      return 'application/json';
    default:
      return 'application/octet-stream'; // A generic fallback
  }
}

export type OpenRouterClient = {
  testConnection: () => Promise<boolean>;
  generateLearningModuleFromPDF: (pdfBuffer: Buffer, fileName: string) => Promise<LearningModuleContent>;
  generateGapAnalysisFromFiles: (files: Array<{fileName: string, fileBuffer: Buffer}>) => Promise<any>;
  evaluateUserAssessment: (questions: AssessmentQuestionData[], userAnswers: string[]) => Promise<{
    score: number;
    totalQuestions: number;
    feedback: Array<{
      questionIndex: number;
      correct: boolean;
      explanation: string;
    }>;
  }>;
  evaluateUserResponse: (question: EvaluationQuestionData, userResponse: string) => Promise<{
    score: number;
    feedback: string;
    suggestions: string[];
  }>;
};

// Schema for structured output
const learningModuleSchema = {
  name: 'learning_module',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Title of the learning module'
      },
      summary: {
        type: 'string',
        description: 'Comprehensive summary of the document (200-300 words)'
      },
      flashcards: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            term: { type: 'string', description: 'Key term or concept' },
            definition: { type: 'string', description: 'Clear definition or explanation' }
          },
          required: ['term', 'definition'],
          additionalProperties: false
        },
        minItems: 10,
        maxItems: 10
      },
      assessment: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'Multiple choice question' },
            options: {
              type: 'array',
              items: { type: 'string' },
              minItems: 4,
              maxItems: 4
            },
            correctAnswer: { type: 'string', description: 'The correct answer option' },
            explanation: { type: 'string', description: 'Why this is the correct answer' }
          },
          required: ['question', 'options', 'correctAnswer', 'explanation'],
          additionalProperties: false
        },
        minItems: 10,
        maxItems: 10
      },
      evaluation: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            scenario: { type: 'string', description: 'Real-world scenario description' },
            question: { type: 'string', description: 'Question about the scenario' },
            sampleAnswer: { type: 'string', description: 'Example of a good answer' },
            evaluationCriteria: {
              type: 'array',
              items: { type: 'string' },
              minItems: 3,
              maxItems: 5
            }
          },
          required: ['scenario', 'question', 'sampleAnswer', 'evaluationCriteria'],
          additionalProperties: false
        },
        minItems: 10,
        maxItems: 10
      }
    },
    required: ['title', 'summary', 'flashcards', 'assessment', 'evaluation'],
    additionalProperties: false
  }
};

const gapAnalysisSchema = {
  name: 'gap_analysis_result',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      employeeId: { type: 'string' },
      employeeName: { type: 'string' },
      jobTitle: { type: 'string' },
      analysisDate: { type: 'string' },
      gaps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            competency: { type: 'string' },
            category: { type: 'string', enum: ['managerial', 'functional'] },
            requiredLevel: { type: 'string', enum: ['Basic', 'Intermediate', 'Advanced'] },
            currentLevel: { type: 'string', enum: ['Basic', 'Intermediate', 'Advanced'] },
            gapLevel: { type: 'number', enum: [0, 1, 2] },
            description: { type: 'string' },
            priority: { type: 'string', enum: ['Low', 'Medium', 'High'] }
          },
          required: ['competency', 'category', 'requiredLevel', 'currentLevel', 'gapLevel', 'description', 'priority'],
          additionalProperties: false
        }
      },
      overallGapScore: { type: 'number', minimum: 0, maximum: 100 },
      recommendations: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['employeeId', 'employeeName', 'jobTitle', 'analysisDate', 'gaps', 'overallGapScore', 'recommendations'],
    additionalProperties: false
  }
};

const evaluationSchema = {
  name: 'evaluation_result',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      score: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: 'Score from 0-100'
      },
      feedback: {
        type: 'string',
        description: 'Detailed feedback about the response'
      },
      suggestions: {
        type: 'array',
        items: { type: 'string' },
        minItems: 3,
        maxItems: 3,
        description: 'Specific suggestions for improvement'
      }
    },
    required: ['score', 'feedback', 'suggestions'],
    additionalProperties: false
  }
};

/**
 * Utility function to clean and parse AI responses that might contain markdown formatting
 */
function parseAIResponse(content: string): any {
  try {
    // First try parsing as-is
    return JSON.parse(content);
  } catch (firstError: any) {
    try {
      // Remove markdown code blocks if present
      const cleanedContent = content
        .replace(/^```json\s*/i, '') // Remove opening ```json
        .replace(/^```\s*/i, '')     // Remove opening ```
        .replace(/\s*```$/i, '')     // Remove closing ```
        .trim();
      return JSON.parse(cleanedContent);
    } catch (secondError: any) {
      try {
        // Try to extract JSON from within the text using regex
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('No valid JSON found in response');
      } catch (thirdError: any) {
        throw new Error(`Failed to parse AI response: ${firstError && firstError.message ? firstError.message : String(firstError)}`);
      }
    }
  }
}

export function createOpenRouterClient(config: OpenRouterConfig, logger: Logger): OpenRouterClient {
  const openai = new OpenAI({
    baseURL: config.baseURL || "https://openrouter.ai/api/v1",
    apiKey: config.apiKey,
    defaultHeaders: {
      "HTTP-Referer": config.siteUrl || "http://localhost:3000",
      "X-Title": config.siteName || "Pelajari App",
    },
  });

  async function testConnection(): Promise<boolean> {
    try {
      logger.info('Testing OpenRouter connection');

      const completion = await openai.chat.completions.create({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: "Hello, this is a connection test. Please respond with 'Connection successful'."
          }
        ],
        max_tokens: 50
      });

      const response = completion.choices[0]?.message?.content;
      const isSuccess = response?.toLowerCase().includes('connection') || response?.toLowerCase().includes('successful');
      
      if (isSuccess) {
        logger.info('OpenRouter connection test successful');
        return true;
      } else {
        logger.warn({ response }, 'OpenRouter connection test returned unexpected response');
        return false;
      }
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'OpenRouter connection test failed');
      return false;
    }
  }

  function encodePDFToBase64(pdfBuffer: Buffer): string {
    const base64PDF = pdfBuffer.toString('base64');
    return `data:application/pdf;base64,${base64PDF}`;
  }

  async function generateLearningModuleFromPDF(pdfBuffer: Buffer, fileName: string): Promise<LearningModuleContent> {
    try {
      logger.info({ fileName, bufferSize: pdfBuffer.length }, 'Generating learning module from PDF using AI');

      // Encode PDF to base64
      const base64PDF = encodePDFToBase64(pdfBuffer);

      const completion = await openai.chat.completions.create({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Please analyze this PDF document and generate a comprehensive learning module. Create:

1. A title for the module based on the document content
2. A concise summary (200-300 words) highlighting the key concepts
3. Exactly 10 flashcards covering the most important terms and concepts
4. Exactly 10 assessment questions (multiple choice) to test understanding
5. Exactly 10 evaluation questions (scenario-based) for deeper analysis

For flashcards: Focus on key terms, definitions, and important concepts.
For assessment questions: Create multiple choice questions with 4 options each, testing comprehension and recall.
For evaluation questions: Create scenario-based questions that require critical thinking and application of the concepts.

Ensure all arrays contain exactly 10 items as specified.`
              },
              {
                type: "file",
                file: {
                  filename: fileName,
                  file_data: base64PDF,
                }
              }
            ]
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: learningModuleSchema
        },
        max_tokens: 12000,
        temperature: 0.7
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content received from AI');
      }

      const parsedContent = JSON.parse(content) as LearningModuleContent;
      
      // Validate the structure
      if (!parsedContent.title || !parsedContent.summary || !parsedContent.flashcards || 
          !parsedContent.assessment || !parsedContent.evaluation) {
        throw new Error('Invalid AI response structure');
      }

      if (parsedContent.flashcards.length !== 10) {
        throw new Error(`Expected 10 flashcards, got ${parsedContent.flashcards.length}`);
      }

      if (parsedContent.assessment.length !== 10) {
        throw new Error(`Expected 10 assessment questions, got ${parsedContent.assessment.length}`);
      }

      if (parsedContent.evaluation.length !== 10) {
        throw new Error(`Expected 10 evaluation questions, got ${parsedContent.evaluation.length}`);
      }

      logger.info({ 
        fileName,
        title: parsedContent.title,
        flashcardsCount: parsedContent.flashcards.length,
        assessmentCount: parsedContent.assessment.length,
        evaluationCount: parsedContent.evaluation.length
      }, 'Learning module generated successfully');

      return parsedContent;
    } catch (error) {
      logger.error({ 
        fileName, 
        bufferSize: pdfBuffer.length,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to generate learning module from PDF');
      throw error;
    }
  }

  /**
   * Enhanced gap analysis with better prompt and error handling
   */
  async function generateGapAnalysisFromFiles(files: Array<{fileName: string, fileBuffer: Buffer}>): Promise<any> {
    try {
      logger.info({ fileNames: files.map(f => f.fileName) }, 'Generating gap analysis from multiple files');

      // Create the file content parts for the message
      const fileContents = files.map(file => {
        const mimeType = getMimeType(file.fileName);
        const base64Data = file.fileBuffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64Data}`;
        
        return {
          type: "file",
          file: {
            filename: file.fileName,
            file_data: dataUrl,
          },
        };
      });

      // Enhanced prompt with clearer instructions about JSON format
      const messages = [
        {
          role: "system",
          content: `You are an expert HR analyst specializing in competency gap analysis. You must return ONLY valid JSON - no markdown, no code blocks, no explanatory text.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Perform a competency gap analysis based on the attached files. Compare the competency framework with employee data.\n\nCRITICAL REQUIREMENTS:\n1. Return ONLY raw JSON (no markdown code blocks like \`\`\`json)\n2. Every gap object must include ALL required fields:\n   - competency (string): exact competency name\n   - category (string): "managerial" or "functional"\n   - requiredLevel (string): "Basic", "Intermediate", or "Advanced"\n   - currentLevel (string): "Basic", "Intermediate", or "Advanced"\n   - gapLevel (number): 0, 1, or 2\n   - description (string): detailed explanation\n   - priority (string): "Low", "Medium", or "High"\n\nReturn the JSON object directly without any formatting or explanation.`
            },
            ...fileContents
          ]
        }
      ];

      // Make the API call
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          "HTTP-Referer": config.siteUrl || "http://localhost:3000",
          "X-Title": config.siteName || "Pelajari App",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: messages,
          response_format: {
            type: "json_schema",
            json_schema: gapAnalysisSchema
          },
          max_tokens: 4000,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
      }

      const completion = await response.json();
      const content = completion.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content received from AI for gap analysis');
      }

      // Use the enhanced parsing function
      let parsedContent;
      try {
        parsedContent = parseAIResponse(content);
      } catch (parseError: any) {
        logger.error({ 
          content: content.substring(0, 500) + '...', 
          parseError: parseError && parseError.message ? parseError.message : String(parseError) 
        }, 'Failed to parse AI response as JSON');
        throw new Error(`AI returned invalid JSON format: ${parseError && parseError.message ? parseError.message : String(parseError)}`);
      }

      // Validate the structure
      if (!parsedContent.gaps || !Array.isArray(parsedContent.gaps)) {
        throw new Error('AI response missing valid gaps array');
      }

      // Validate each gap object
      for (let i = 0; i < parsedContent.gaps.length; i++) {
        const gap = parsedContent.gaps[i];
        const requiredFields = ['competency', 'category', 'requiredLevel', 'currentLevel', 'gapLevel', 'description', 'priority'];
        
        for (const field of requiredFields) {
          if (!(field in gap)) {
            logger.error({ 
              gapIndex: i, 
              gap, 
              missingField: field 
            }, 'Gap object missing required field');
            throw new Error(`Gap analysis item ${i} missing required field: ${field}`);
          }
        }
      }

      logger.info({ 
        employeeName: parsedContent.employeeName,
        gapsFound: parsedContent.gaps.length,
        overallScore: parsedContent.overallGapScore
      }, 'Gap analysis generated successfully by AI');
      
      return parsedContent;

    } catch (error) {
      const fileNames = files.map(f => f.fileName).join(', ');
      logger.error({
        error: error instanceof Error ? { message: error.message, stack: error.stack } : 'Unknown error',
        fileNames
      }, 'Failed to generate gap analysis from files');
      throw error;
    }
  }

  async function evaluateUserAssessment(questions: AssessmentQuestionData[], userAnswers: string[]) {
    try {
      logger.info({ questionsCount: questions.length, answersCount: userAnswers.length }, 'Evaluating user assessment');

      let score = 0;
      const feedback = questions.map((question, index) => {
        const userAnswer = userAnswers[index];
        const isCorrect = userAnswer === question.correctAnswer;
        if (isCorrect) score++;

        return {
          questionIndex: index,
          correct: isCorrect,
          explanation: isCorrect ? 
            `Correct! ${question.explanation}` : 
            `Incorrect. The correct answer is "${question.correctAnswer}". ${question.explanation}`
        };
      });

      logger.info({ score, totalQuestions: questions.length }, 'Assessment evaluation completed');

      return {
        score,
        totalQuestions: questions.length,
        feedback
      };
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to evaluate user assessment');
      throw error;
    }
  }

  async function evaluateUserResponse(question: EvaluationQuestionData, userResponse: string) {
    try {
      logger.info({ scenario: question.scenario.substring(0, 50) }, 'Evaluating user response to evaluation question');

      const completion = await openai.chat.completions.create({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: `Evaluate this user's response to an evaluation question:

**Scenario:** ${question.scenario}

**Question:** ${question.question}

**Sample Answer:** ${question.sampleAnswer}

**Evaluation Criteria:** ${question.evaluationCriteria.join(', ')}

**User's Response:** ${userResponse}

Please evaluate the user's response and provide:
1. A score from 0-100 based on how well they addressed the question and criteria
2. Constructive feedback explaining strengths and areas for improvement
3. Exactly 3 specific suggestions for improvement`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: evaluationSchema
        },
        max_tokens: 1000,
        temperature: 0.5
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content received from AI');
      }

      const evaluation = JSON.parse(content);
      
      logger.info({ score: evaluation.score }, 'User response evaluation completed');

      return evaluation;
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'Failed to evaluate user response');
      throw error;
    }
  }

  return {
    testConnection,
    generateLearningModuleFromPDF,
    generateGapAnalysisFromFiles,
    evaluateUserAssessment,
    evaluateUserResponse,
  };
} 