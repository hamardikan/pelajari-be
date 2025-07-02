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
  frameworkData: JobCompetencyFrameworkData;
  employeeData: EmployeeData;
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

const resilienceConfig = createResilienceConfig({
  retry: {
    retries: 3,
    factor: 2,
    minTimeout: 2000,
    maxTimeout: 30000,
    randomize: true,
  },
  circuitBreaker: {
    timeout: 180000, // 3 minutes for IDP AI processing (longer than learning)
    errorThresholdPercentage: 50,
    resetTimeout: 60000,
    minimumHalfOpenRequests: 1,
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

const resilientGapAnalysisProcessing = withResilience(
  (frameworkData: JobCompetencyFrameworkData, employeeData: EmployeeData) => {
    const files = [
      {
        fileName: `framework-${frameworkData.jobTitle.replace(/\s+/g, '_')}.json`,
        fileBuffer: Buffer.from(JSON.stringify(frameworkData, null, 2)),
      },
      {
        fileName: `employee-${employeeData.employeeName.replace(/\s+/g, '_')}.json`,
        fileBuffer: Buffer.from(JSON.stringify(employeeData, null, 2)),
      },
    ];
    return openRouterClient.generateGapAnalysisFromFiles(files);
  },
  resilienceConfig,
  logger
);

async function processGapAnalysis(data: GapAnalysisWorkerData) {
  const { frameworkData, employeeData } = data;
  
  const result = await resilientGapAnalysisProcessing('gap-analysis', frameworkData, employeeData);
  
  if (!result.success) {
    throw result.error || new Error('Gap analysis AI processing failed');
  }

  // The new function returns pre-parsed JSON, so we just return it
  return result.data;
}

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

**PANDUAN PEMBUATAN IDP:**
1. Untuk karyawan dengan klasifikasi "${nineBoxClassification}":
   ${nineBoxClassification.includes('Rising Star') || nineBoxClassification.includes('Top Talent') ? 
     '- Prioritaskan stretch assignments dan mentorship\n   - Berikan tantangan pengembangan leadership\n   - Fokus pada pengembangan jangka panjang' :
   nineBoxClassification.includes('High Performer') || nineBoxClassification.includes('Key Player') ?
     '- Berikan program pelatihan advance\n   - Kombinasikan training formal dan on-the-job learning\n   - Fokus pada kompetensi spesifik' :
     '- Fokus pada fundamental skills\n   - Berikan coaching intensif\n   - Mulai dengan program basic level'}

2. Prioritaskan 3-5 kompetensi dengan gap tertinggi
3. Pilih 1-2 program yang paling relevan untuk setiap kompetensi
4. Tentukan timeframe yang realistis (3-12 bulan)
5. Definisikan success metrics yang terukur

**FORMAT OUTPUT:** Berikan hasil dalam format JSON yang valid:

{
  "employeeId": "${employeeId}",
  "employeeName": "${employeeName}",
  "title": "Individual Development Plan - [Nama Karyawan]",
  "description": "Deskripsi singkat tujuan IDP ini",
  "gapAnalysisId": "akan diisi oleh sistem",
  "nineBoxClassification": "${nineBoxClassification}",
  "developmentGoals": [
    {
      "id": "goal-1",
      "competency": "Nama Kompetensi",
      "currentLevel": "Basic" | "Intermediate" | "Advanced",
      "targetLevel": "Basic" | "Intermediate" | "Advanced", 
      "priority": "Low" | "Medium" | "High",
      "timeframe": "3-6 bulan",
      "description": "Deskripsi detail goal pengembangan",
      "programs": [
        {
          "programId": "akan diisi oleh sistem",
          "programName": "Nama Program dari katalog",
          "type": "Coaching" | "Mentoring" | "Training" | "Job Rotation" | "Special Assignment" | "Online Course",
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
}

Pastikan IDP realistis, terukur, dan sesuai dengan klasifikasi 9-Box karyawan. Gunakan program dari katalog yang tersedia.`;

  const result = await resilientAIProcessing('idp-generation', prompt);
  
  if (!result.success) {
    throw result.error || new Error('IDP generation AI processing failed');
  }

  try {
    const idpPlan = JSON.parse(result.data);
    
    if (!idpPlan.developmentGoals || !Array.isArray(idpPlan.developmentGoals)) {
      throw new Error('Invalid IDP response structure');
    }

    return idpPlan;
  } catch (error) {
    logger.error({ error, response: result.data }, 'Failed to parse IDP JSON response');
    throw new Error('Invalid JSON response from AI for IDP generation');
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
    "areasForImprovement": ["Area yang masih perlu diperbaiki"]
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