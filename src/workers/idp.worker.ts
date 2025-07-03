import { parentPort, workerData } from 'worker_threads';
import OpenAI from 'openai';
import { createOpenRouterClient } from '../shared/utils/openrouter.js';
import { createLogger } from '../config/logger.js';
import { getEnvironmentConfig } from '../config/environment.js';
import { withResilience, createResilienceConfig } from '../shared/utils/resilience.js';
import type { 
  JobCompetencyFrameworkData, 
  EmployeeData, 
  NineBoxClassification,
  DevelopmentProgramData 
} from '../idp/idp.schemas.js';

// Worker data structures for different IDP tasks
interface GapAnalysisWorkerData {
  type: 'gap-analysis';
  frameworkText: string;
  employeeText: string;
  employeeName: string;
  jobTitle: string;
  employeeId?: string;
  userId: string;
}

interface IDPGenerationWorkerData {
  type: 'idp-generation';
  employeeId: string;
  employeeName: string;
  gapAnalysisData: any;
  nineBoxClassification: NineBoxClassification;
  developmentPrograms: DevelopmentProgramData[];
  userId: string;
}

interface ImpactMeasurementWorkerData {
  type: 'impact-measurement';
  employeeId: string;
  previousAnalysis: any;
  currentAnalysis: any;
  userId: string;
}

type WorkerData = GapAnalysisWorkerData | IDPGenerationWorkerData | ImpactMeasurementWorkerData;

const config = getEnvironmentConfig();
const logger = createLogger(config);

const openRouterClient = createOpenRouterClient({
  apiKey: config.OPENROUTER_API_KEY,
  siteUrl: config.SITE_URL,
  siteName: config.SITE_NAME,
}, logger);

// More lenient resilience config to avoid premature circuit breaking
const resilienceConfig = createResilienceConfig({
  retry: {
    retries: 5, // Increased retries
    factor: 1.5, // More gradual backoff
    minTimeout: 1000,
    maxTimeout: 20000,
    randomize: true,
  },
  circuitBreaker: {
    timeout: 300000, // 5 minutes for IDP AI processing
    errorThresholdPercentage: 70, // Higher threshold before opening
    resetTimeout: 120000, // 2 minutes before trying half-open
    minimumHalfOpenRequests: 2,
    name: 'idp-ai-processing',
  },
  deadLetterQueue: {
    enabled: false,
    maxRetries: 3,
  },
});

// Create direct OpenAI client for text completion
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: config.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": config.SITE_URL || "http://localhost:3000",
    "X-Title": config.SITE_NAME || "Pelajari App",
  },
});

const resilientAIProcessing = withResilience(
  async (prompt: string) => {
    logger.info({ taskType: 'generic-ai-prompt' }, 'Sending IDP request to OpenRouter for processing');
    
    const completion = await openai.chat.completions.create({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content returned from OpenRouter');
    }

    return content; // Return raw string content
  },
  resilienceConfig,
  logger
);

/**
 * Enhanced JSON parsing that handles markdown code blocks and other formatting
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
        // Log the actual content for debugging
        logger.error({ 
          content: content.substring(0, 1000),
          firstError: firstError && firstError.message ? firstError.message : String(firstError),
          secondError: secondError && secondError.message ? secondError.message : String(secondError),
          thirdError: thirdError && thirdError.message ? thirdError.message : String(thirdError)
        }, 'All JSON parsing attempts failed');
        throw new Error(`Failed to parse AI response: ${firstError && firstError.message ? firstError.message : String(firstError)}`);
      }
    }
  }
}

// Enhanced gap analysis with direct API call and fallback
async function processGapAnalysis(data: GapAnalysisWorkerData) {
  const { frameworkText, employeeText, employeeName, jobTitle, employeeId } = data;

  try {
    logger.info({ employeeName, jobTitle }, 'Starting gap analysis with unstructured text prompt');

    const prompt = `
      You are an expert HR analyst specializing in competency gap analysis.
      Your task is to analyze two documents and produce a structured JSON output.

      **DOCUMENT 1: Job Competency Framework**
      ---
      ${frameworkText}
      ---

      **DOCUMENT 2: Employee Performance Data**
      ---
      ${employeeText}
      ---

      **INSTRUCTIONS:**
      1.  Read both documents carefully to understand the required competencies for the job and the employee's current performance.
      2.  Compare the employee's data against the job framework to identify gaps.
      3.  Determine the current and required proficiency levels (e.g., Basic, Intermediate, Advanced) for each competency.
      4.  Calculate a gap level (0 for no gap, 1 for a minor gap, 2 for a major gap).
      5.  Provide a priority for closing each gap (Low, Medium, High).
      6.  Generate a final JSON object containing the full analysis.

      **CRITICAL:** You must return ONLY a single, valid JSON object. Do not include any explanatory text, markdown code blocks (e.g., fenced code blocks), or any other characters outside of the JSON structure.

      Required top-level keys:
      * employeeId (string)
      * employeeName (string)
      * jobTitle (string)
      * analysisDate (YYYY-MM-DD)
      * kpiScore (number 0-100 parsed from the employee document)
      * potentialScore (number 0-100 parsed from the assessment results)
      * gaps (array, see below)
      * overallGapScore (number 0-100)
      * recommendations (array of strings)

      Example structure:
      {
        "employeeId": "${employeeId ?? 'a-generated-uuid'}",
        "employeeName": "${employeeName}",
        "jobTitle": "${jobTitle}",
        "analysisDate": "2025-07-03",
        "kpiScore": 78,
        "potentialScore": 85,
        "gaps": [
          {
            "competency": "Strategic Planning",
            "category": "managerial",
            "requiredLevel": "Advanced",
            "currentLevel": "Intermediate",
            "gapLevel": 1,
            "description": "...",
            "priority": "Medium"
          }
        ],
        "overallGapScore": 69,
        "recommendations": ["…"]
      }
    `;

    const result = await resilientAIProcessing('gap-analysis-unstructured', prompt);

    if (!result.success) {
      throw result.error || new Error('Gap analysis AI processing failed');
    }

    try {
      const parsedResult = parseAIResponse(result.data);

      if (!parsedResult.gaps || !Array.isArray(parsedResult.gaps)) {
        throw new Error('Invalid gap analysis response structure from AI');
      }

      logger.info({ employeeName, gapsFound: parsedResult.gaps.length }, 'Gap analysis from unstructured text completed successfully');

      return parsedResult;

    } catch (parseError: any) {
      logger.error({
        parseError: parseError && parseError.message ? parseError.message : String(parseError),
        response: result.data.substring(0, 1000) + '...'
      }, 'Failed to parse gap analysis JSON response');
      throw new Error(`Invalid JSON response from AI for gap analysis: ${parseError && parseError.message ? parseError.message : String(parseError)}`);
    }
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error), employeeName }, 'Failed to process gap analysis from unstructured text');
    throw error;
  }
}

// Rest of the functions remain the same...
async function processIDPGeneration(data: IDPGenerationWorkerData) {
  const { employeeId, employeeName, gapAnalysisData, nineBoxClassification, developmentPrograms, userId } = data;

  const prompt = `Anda adalah seorang ahli Learning & Development yang berpengalaman dalam membuat Individual Development Plan (IDP). Berdasarkan data berikut, buatlah sebuah IDP yang terstruktur, praktis, dan dapat ditindaklanjuti.

**DATA KARYAWAN:**
ID: ${employeeId}
Nama: ${employeeName}
Klasifikasi 9-Box Grid: ${nineBoxClassification}

**HASIL ANALISIS KESENJANGAN:**
${JSON.stringify(gapAnalysisData, null, 2)}

**KATALOG PROGRAM PENGEMBANGAN YANG TERSEDIA:**
${developmentPrograms.map(program => 
  `- ${program.name} (${program.type})
    Deskripsi: ${program.description}
    Durasi: ${program.duration}
    Target Kompetensi: ${program.targetCompetencies.join(', ')}
    ${program.provider ? `Provider: ${program.provider}` : ''}
    ${program.cost ? `Biaya: ${program.cost}` : 'Gratis'}`
).join('\n\n')}

**IMPORTANT:** Return ONLY valid JSON without markdown formatting or code blocks.

Berikan hasil dalam format JSON yang valid tanpa markdown:

{
  "employeeId": "${employeeId}",
  "employeeName": "${employeeName}",
  "title": "Individual Development Plan - ${employeeName}",
  "description": "Deskripsi singkat tujuan IDP ini",
  "nineBoxClassification": "${nineBoxClassification}",
  "developmentGoals": [
    {
      "id": "goal-1",
      "competency": "Nama Kompetensi",
      "currentLevel": "Basic",
      "targetLevel": "Intermediate", 
      "priority": "High",
      "timeframe": "3-6 bulan",
      "description": "Deskripsi detail goal pengembangan",
      "programs": [
        {
          "programId": "akan diisi oleh sistem",
          "programName": "Nama Program dari katalog",
          "type": "Training",
          "status": "Not Started",
          "completionPercentage": 0
        }
      ],
      "successMetrics": [
        "Metrik keberhasilan 1",
        "Metrik keberhasilan 2"
      ]
    }
  ],
  "overallProgress": {
    "status": "Draft",
    "completionPercentage": 0
  },
  "approvedByManager": false
}`;

  const result = await resilientAIProcessing('idp-generation', prompt);
  
  if (!result.success) {
    throw result.error || new Error('IDP generation AI processing failed');
  }

  try {
    const idpPlan = parseAIResponse(result.data);
    
    if (!idpPlan.developmentGoals || !Array.isArray(idpPlan.developmentGoals)) {
      throw new Error('Invalid IDP response structure');
    }

    return idpPlan;
  } catch (error: any) {
    logger.error({ 
      error: error && error.message ? error.message : String(error), 
      response: result.data.substring(0, 1000) + '...'
    }, 'Failed to parse IDP JSON response');
    throw new Error(`Invalid JSON response from AI for IDP generation: ${error && error.message ? error.message : String(error)}`);
  }
}

async function processImpactMeasurement(data: ImpactMeasurementWorkerData) {
  const { employeeId, previousAnalysis, currentAnalysis, userId } = data;

  const prompt = `Anda adalah seorang analis HR yang ahli dalam mengukur dampak dan ROI program pengembangan. Berdasarkan data analisis kesenjangan "sebelum" dan "sesudah", buatlah laporan dampak yang komprehensif.

**ANALISIS SEBELUM PROGRAM IDP:**
${JSON.stringify(previousAnalysis, null, 2)}

**ANALISIS SETELAH PROGRAM IDP:**
${JSON.stringify(currentAnalysis, null, 2)}

**INSTRUKSI ANALISIS DAMPAK:**
1. Bandingkan skor gap sebelum dan sesudah untuk setiap kompetensi
2. Hitung tingkat perbaikan (improvement rate) per kompetensi
3. Identifikasi kompetensi mana yang mengalami perbaikan terbesar
4. Berikan insight tentang efektivitas program pengembangan
5. Rekomendasikan next steps untuk pengembangan lebih lanjut

**FORMAT OUTPUT:** Berikan hasil dalam format JSON:

{
  "employeeId": "${employeeId}",
  "measurementDate": "${new Date().toISOString().split('T')[0]}",
  "overallImpact": {
    "previousGapScore": 0-100,
    "currentGapScore": 0-100,
    "improvementPercentage": 0-100,
    "status": "Significant Improvement" | "Moderate Improvement" | "Minimal Improvement" | "No Improvement"
  },
  "competencyImpacts": [
    {
      "competency": "Nama Kompetensi",
      "previousGapLevel": 0 | 1 | 2,
      "currentGapLevel": 0 | 1 | 2,
      "improvementLevel": "Major" | "Minor" | "None",
      "notes": "Catatan tentang perkembangan"
    }
  ],
  "insights": [
    "Insight 1 tentang efektivitas program",
    "Insight 2 tentang area yang perlu perhatian"
  ],
  "recommendations": [
    "Rekomendasi untuk pengembangan selanjutnya",
    "Saran untuk perbaikan program"
  ],
  "roi": {
    "qualitativeAssessment": "Deskripsi ROI secara kualitatif",
    "keySuccessFactors": ["Faktor kunci keberhasilan"],
    "areasForImprovement": ["Area yang masih perlu diperbaikan"]
  }
}`;

  const result = await resilientAIProcessing('impact-measurement', prompt);
  
  if (!result.success) {
    throw result.error || new Error('Impact measurement AI processing failed');
  }

  try {
    const impactReport = JSON.parse(result.data);
    
    if (!impactReport.overallImpact || !impactReport.competencyImpacts) {
      throw new Error('Invalid impact measurement response structure');
    }

    return impactReport;
  } catch (error) {
    logger.error({ error, response: result.data }, 'Failed to parse impact measurement JSON response');
    throw new Error('Invalid JSON response from AI for impact measurement');
  }
}

async function processIDPTask() {
  try {
    const data = workerData as WorkerData;
    
    logger.info({ 
      taskType: data.type,
      userId: data.userId 
    }, 'Worker starting IDP task processing');

    let result;

    switch (data.type) {
      case 'gap-analysis':
        result = await processGapAnalysis(data);
        break;
      case 'idp-generation':
        result = await processIDPGeneration(data);
        break;
      case 'impact-measurement':
        result = await processImpactMeasurement(data);
        break;
      default:
        throw new Error(`Unknown IDP task type: ${(data as any).type}`);
    }

    logger.info({ 
      taskType: data.type,
      userId: data.userId 
    }, 'IDP task processing completed successfully');

    parentPort?.postMessage({ success: true, data: result });
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      taskType: (workerData as WorkerData).type 
    }, 'Worker failed to process IDP task');
    
    parentPort?.postMessage({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info({}, 'IDP Worker received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info({}, 'IDP Worker received SIGINT, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error({ error: error.message }, 'Uncaught exception in IDP worker');
  parentPort?.postMessage({
    success: false,
    error: error.message,
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection in IDP worker');
  parentPort?.postMessage({
    success: false,
    error: reason instanceof Error ? reason.message : 'Unhandled promise rejection',
  });
  process.exit(1);
});

// Start processing
processIDPTask();