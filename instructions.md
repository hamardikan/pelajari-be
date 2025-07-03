IDP Module Refactoring InstructionsObjectiveRefactor the Individual Development Plan (IDP) module to create a "one-shot" process. When a user uploads the necessary documents (competency framework and employee data), the backend should automatically:Generate the Gap Analysis.Generate the 9-Box Grid classification.Generate the Individual Development Plan (IDP).This entire process should be triggered by a single API call. The API will then return the IDs of the created Gap Analysis and IDP.1. Modify idp.services.tsThis is the most critical part of the refactoring. The logic needs to be consolidated within the idp.services.ts file.1.1. Update Service and Result TypesIn src/idp/idp.services.ts, modify the GapAnalysisResult type to include the idpId.Change this:export type GapAnalysisResult = {
  analysisId: string;
  status: 'processing' | 'completed' | 'failed';
  message: string;
};
To this:export type GapAnalysisResult = {
  analysisId: string;
  idpId: string; // Add this
  status: 'processing' | 'completed' | 'failed';
  message: string;
};
Also, update the analyzeCompetencyGapsFromFiles signature in the IDPService type definition to reflect the new return type.Change this:analyzeCompetencyGapsFromFiles: (frameworkFile: Express.Multer.File, employeeFile: Express.Multer.File, userId: string, employeeId?: string) => Promise<GapAnalysisResult>;
(The old definition might just return Promise<GapAnalysisResult> without the idpId)1.2. Orchestrate the One-Shot Flow in analyzeCompetencyGapsFromFilesModify the analyzeCompetencyGapsFromFiles function to chain the required service calls.Inside the worker.on('message', async (message) => { ... }) callback, after successfully creating the gap analysis record (newAnalysis), add the logic to map the 9-box and generate the IDP.Location: src/idp/idp.services.ts -> analyzeCompetencyGapsFromFiles -> worker.on('message', ...)Refactoring Logic:// ... inside the worker.on('message', async (message) => {
// ... after checking if message.success is true

try {
    // This part already exists
    const gapAnalysisData: CompetencyGapData = {
      ...message.data,
      employeeId: employeeId || message.data.employeeId,
      createdBy: userId,
    };

    // Store in DB (This also exists)
    const newAnalysis = await idpRepository.createGapAnalysis(gapAnalysisData);

    // ---- START NEW LOGIC ----

    // 1. Map to 9-Box Grid
    const { kpiScore, potentialScore } = message.data;
    if (typeof kpiScore === 'number' && typeof potentialScore === 'number') {
      await mapTalentTo9Box(gapAnalysisData.employeeId, kpiScore, potentialScore);
    }

    // 2. Generate the IDP immediately
    const idpResult = await generateIDP(gapAnalysisData.employeeId, userId);

    logger.info({
        userId,
        analysisId: newAnalysis.id,
        idpId: idpResult.idpId
    }, 'One-shot process completed: Gap analysis, 9-box, and IDP generated.');

    // 3. Resolve with both IDs
    resolve({
      analysisId: newAnalysis.id,
      idpId: idpResult.idpId, // Return the new IDP ID
      status: 'completed',
      message: 'Gap analysis and IDP generation completed successfully',
    });

    // ---- END NEW LOGIC ----

} catch (dbError) {
    logger.error({ userId, error: dbError }, 'Failed during one-shot gap analysis and IDP generation');
    reject(dbError);
}

// ... rest of the function
1.3. Update analyzeCompetencyGaps (JSON input version)Apply the same orchestration logic to the analyzeCompetencyGaps function, which handles JSON input instead of files. This ensures both entry points for gap analysis follow the new one-shot flow.Location: src/idp/idp.services.ts -> analyzeCompetencyGaps -> worker.on('message', ...)2. Update idp.handlers.tsThe analyzeCompetencyGaps handler now receives an object containing both analysisId and idpId. Ensure the response sent back to the client reflects this.Location: src/idp/idp.handlers.ts -> analyzeCompetencyGapsChange this:// Old logging and response
logger.info({
  correlationId,
  userId,
  analysisId: result.analysisId,
  status: result.status
}, 'Gap analysis request processed');

res.status(201).json({
  success: true,
  message: 'Gap analysis initiated successfully',
  data: result,
  correlationId,
});
To this:// New logging and response
logger.info({
  correlationId,
  userId,
  analysisId: result.analysisId,
  idpId: result.idpId, // Log the new ID
  status: result.status
}, 'Gap analysis and IDP generation request processed');

res.status(201).json({
  success: true,
  message: 'Gap analysis and IDP generation initiated successfully',
  data: result, // result now contains both IDs
  correlationId,
});
3. Verify Other FilesNo changes should be necessary in the following files, but it's good practice to verify:idp.routes.ts: The route POST /gap-analysis remains the same. No changes needed.idp.repositories.ts: The repository methods for creating individual records (createGapAnalysis, createIDP, etc.) are still valid and will be called by the service layer. No changes needed.idp.worker.ts: The worker's responsibility is only to perform the AI analysis for a specific task (e.g., gap analysis). It should not be changed. The orchestration happens in the service layer.After applying these changes, the backend will support the new one-shot IDP generation flow as requested.