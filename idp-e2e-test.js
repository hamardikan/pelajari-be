#!/usr/bin/env node

/**
 * IDP End-to-End Test Script
 * Tests the complete Individual Development Plan workflow
 * 
 * Workflow:
 * 1. Gap Analysis - Analyze competency gaps
 * 2. Nine-Box Mapping - Map talent to 9-Box Grid
 * 3. IDP Generation - Generate Individual Development Plan
 * 4. IDP Approval - Manager approval workflow
 * 5. Progress Updates - Track development progress
 * 6. Impact Measurement - Measure development impact
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

// Configuration
const BASE_URL = 'http://localhost:3000';
const USER_ID = 'ee6feb25-09e8-46b3-b15c-71ee4254903e';

// Test data
const TEST_DATA = {
  competencyFramework: {
    jobTitle: "Senior Software Engineer",
    managerialCompetencies: [
      {
        name: "Team Leadership",
        expectedLevel: "Intermediate",
        description: "Ability to lead and mentor team members effectively"
      },
      {
        name: "Strategic Thinking",
        expectedLevel: "Advanced",
        description: "Capacity to think strategically about technology decisions"
      },
      {
        name: "Communication",
        expectedLevel: "Advanced", 
        description: "Clear communication with stakeholders at all levels"
      }
    ],
    functionalCompetencies: [
      {
        name: "Software Architecture",
        expectedLevel: "Advanced",
        description: "Design and implement scalable software architectures"
      },
      {
        name: "Database Design",
        expectedLevel: "Intermediate",
        description: "Design efficient and normalized database schemas"
      },
      {
        name: "DevOps Practices",
        expectedLevel: "Intermediate",
        description: "Implement CI/CD pipelines and deployment strategies"
      }
    ]
  },
  employeeData: {
    employeeId: USER_ID, // Add explicit employeeId
    employeeName: "John Smith",
    currentJobTitle: "Software Engineer",
    performanceSummary: "John has consistently delivered high-quality code and has shown strong technical skills. However, he needs to improve his leadership and communication skills to advance to senior roles. His database knowledge is solid but could be enhanced for complex enterprise applications.",
    kpiScore: 78,
    assessmentResults: {
      potentialScore: 85,
      summary: "High potential employee with strong technical foundation. Shows excellent problem-solving abilities and is eager to learn. Demonstrates good collaboration skills but needs development in leadership and strategic thinking areas.",
      competencyScores: [
        { competencyName: "Team Leadership", score: 45 },
        { competencyName: "Strategic Thinking", score: 55 },
        { competencyName: "Communication", score: 70 },
        { competencyName: "Software Architecture", score: 82 },
        { competencyName: "Database Design", score: 68 },
        { competencyName: "DevOps Practices", score: 75 }
      ]
    }
  },
  developmentPrograms: [
    {
      name: "Leadership Fundamentals",
      type: "Training",
      description: "Comprehensive program covering leadership basics, team motivation, and conflict resolution",
      duration: "6 weeks",
      targetCompetencies: ["Team Leadership", "Communication"],
      provider: "Learning Institute",
      cost: 1500
    },
    {
      name: "Strategic Thinking Workshop",
      type: "Training", 
      description: "Workshop on strategic planning, decision making, and business analysis",
      duration: "3 days",
      targetCompetencies: ["Strategic Thinking"],
      provider: "Business Academy",
      cost: 800
    },
    {
      name: "Advanced Database Design",
      type: "Online Course",
      description: "Advanced concepts in database design, optimization, and performance tuning",
      duration: "8 weeks",
      targetCompetencies: ["Database Design"],
      provider: "TechLearn",
      cost: 600
    }
  ]
};

// Utility functions
async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  
  const response = await fetch(url, { ...defaultOptions, ...options });
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} - ${JSON.stringify(data)}`);
  }
  
  return data;
}

function logStep(step, message) {
  console.log(`\n🔍 STEP ${step}: ${message}`);
  console.log('═'.repeat(60));
}

function logSuccess(message) {
  console.log(`✅ ${message}`);
}

function logError(message) {
  console.log(`❌ ${message}`);
}

function logInfo(message) {
  console.log(`ℹ️  ${message}`);
}

// Test functions
async function setupDevelopmentPrograms() {
  logStep(0, 'Setting up Development Programs');
  
  // First, check if programs already exist
  try {
    const existingPrograms = await makeRequest('/api/idp/programs');
    logInfo(`Found ${existingPrograms.data.programs.length} existing programs`);
    
    // Check if our test programs already exist
    const existingProgramNames = existingPrograms.data.programs.map(p => p.data.name);
    const testProgramNames = TEST_DATA.developmentPrograms.map(p => p.name);
    
    const missingPrograms = TEST_DATA.developmentPrograms.filter(
      program => !existingProgramNames.includes(program.name)
    );
    
    if (missingPrograms.length === 0) {
      logSuccess('All required programs already exist in the system');
      return existingPrograms.data.programs.filter(p => 
        testProgramNames.includes(p.data.name)
      );
    }
    
    logInfo(`Need to create ${missingPrograms.length} missing programs`);
    
    // Create only missing programs
    const createdPrograms = [];
    
    for (const program of missingPrograms) {
      try {
        const response = await makeRequest('/api/idp/programs', {
          method: 'POST',
          body: JSON.stringify(program)
        });
        
        createdPrograms.push(response.data.program);
        logSuccess(`Created program: ${program.name}`);
      } catch (error) {
        logError(`Failed to create program ${program.name}: ${error.message}`);
      }
    }
    
    // Return all relevant programs (existing + newly created)
    const allRelevantPrograms = [
      ...existingPrograms.data.programs.filter(p => testProgramNames.includes(p.data.name)),
      ...createdPrograms
    ];
    
    return allRelevantPrograms;
    
  } catch (error) {
    logError(`Failed to fetch existing programs: ${error.message}`);
    
    // Fallback: try to create all programs
    const createdPrograms = [];
    
    for (const program of TEST_DATA.developmentPrograms) {
      try {
        const response = await makeRequest('/api/idp/programs', {
          method: 'POST',
          body: JSON.stringify(program)
        });
        
        createdPrograms.push(response.data.program);
        logSuccess(`Created program: ${program.name}`);
      } catch (error) {
        // Program might already exist, continue
        logInfo(`Program ${program.name} might already exist: ${error.message}`);
      }
    }
    
    return createdPrograms;
  }
}

async function performGapAnalysis() {
  logStep(1, 'Competency Gap Analysis');
  
  const gapAnalysisData = {
    frameworkData: TEST_DATA.competencyFramework,
    employeeData: TEST_DATA.employeeData
  };
  
  try {
    const response = await makeRequest('/api/idp/gap-analysis', {
      method: 'POST',
      body: JSON.stringify(gapAnalysisData)
    });
    
    logSuccess(`Gap analysis initiated: ${response.data.analysisId}`);
    logInfo(`Status: ${response.data.status}`);
    
    let analysisResponse; // Declare outside the if block
    
    // Wait for analysis to complete (AI processing)
    if (response.data.status === 'processing') {
      logInfo('Waiting for AI processing to complete...');
      
      // Poll for completion with exponential backoff
      let attempts = 0;
      const maxAttempts = 6; // Max 3 minutes total
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
        attempts++;
        
        try {
          analysisResponse = await makeRequest(`/api/idp/gap-analysis/${USER_ID}`);
          break; // Success, exit loop
        } catch (error) {
          if (attempts >= maxAttempts) {
            throw new Error(`Gap analysis not completed after ${maxAttempts * 30} seconds`);
          }
          logInfo(`Attempt ${attempts}/${maxAttempts} - Analysis still processing...`);
        }
      }
      
      if (!analysisResponse) {
        throw new Error('Failed to retrieve gap analysis after waiting');
      }
    } else {
      // If status is 'completed', fetch immediately
      analysisResponse = await makeRequest(`/api/idp/gap-analysis/${USER_ID}`);
    }
    logSuccess(`Gap analysis completed for ${analysisResponse.data.analysis.data.employeeName}`);
    logInfo(`Overall gap score: ${analysisResponse.data.analysis.data.overallGapScore}`);
    logInfo(`Number of gaps identified: ${analysisResponse.data.analysis.data.gaps.length}`);
    
    return analysisResponse.data.analysis;
  } catch (error) {
    logError(`Gap analysis failed: ${error.message}`);
    throw error;
  }
}

async function performNineBoxMapping() {
  logStep(2, 'Nine-Box Grid Mapping');
  
  const { kpiScore, assessmentResults } = TEST_DATA.employeeData;
  
  try {
    const response = await makeRequest(`/api/idp/employees/${USER_ID}/nine-box`, {
      method: 'POST',
      body: JSON.stringify({
        kpiScore,
        assessmentScore: assessmentResults.potentialScore
      })
    });
    
    logSuccess(`Nine-Box classification: ${response.data.classification}`);
    logInfo(`KPI Score: ${kpiScore}, Assessment Score: ${assessmentResults.potentialScore}`);
    
    return response.data.classification;
  } catch (error) {
    logError(`Nine-Box mapping failed: ${error.message}`);
    throw error;
  }
}

async function generateIDP() {
  logStep(3, 'Individual Development Plan Generation');
  
  try {
    const response = await makeRequest(`/api/idp/generate/${USER_ID}`, {
      method: 'POST'
    });
    
    logSuccess(`IDP generation initiated: ${response.data.idpId}`);
    logInfo(`Status: ${response.data.status}`);
    
    let idpResponse; // Declare outside the if block
    
    // Wait for IDP generation to complete (AI processing)
    if (response.data.status === 'processing') {
      logInfo('Waiting for AI processing to complete...');
      
      // Poll for completion with exponential backoff
      let attempts = 0;
      const maxAttempts = 9; // Max 4.5 minutes total
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
        attempts++;
        
        try {
          idpResponse = await makeRequest(`/api/idp/employees/${USER_ID}`);
          break; // Success, exit loop
        } catch (error) {
          if (attempts >= maxAttempts) {
            throw new Error(`IDP generation not completed after ${maxAttempts * 30} seconds`);
          }
          logInfo(`Attempt ${attempts}/${maxAttempts} - IDP generation still processing...`);
        }
      }
      
      if (!idpResponse) {
        throw new Error('Failed to retrieve IDP after waiting');
      }
    } else {
      // If status is 'completed', fetch immediately
      idpResponse = await makeRequest(`/api/idp/employees/${USER_ID}`);
    }
    logSuccess(`IDP generated for ${idpResponse.data.idp.data.employeeName}`);
    logInfo(`Number of development goals: ${idpResponse.data.idp.data.developmentGoals.length}`);
    logInfo(`Overall status: ${idpResponse.data.idp.data.overallProgress.status}`);
    
    // Log development goals summary
    idpResponse.data.idp.data.developmentGoals.forEach((goal, index) => {
      logInfo(`Goal ${index + 1}: ${goal.competency} (${goal.priority} priority)`);
    });
    
    return idpResponse.data.idp;
  } catch (error) {
    logError(`IDP generation failed: ${error.message}`);
    throw error;
  }
}

async function approveIDP(idp) {
  logStep(4, 'IDP Manager Approval');
  
  const approvalData = {
    managerId: USER_ID, // Using same user as manager for test
    comments: "This IDP looks comprehensive and well-structured. I approve the proposed development goals and programs."
  };
  
  try {
    const response = await makeRequest(`/api/idp/${idp.id}/approve`, {
      method: 'PUT',
      body: JSON.stringify(approvalData)
    });
    
    logSuccess(`IDP approved by manager`);
    logInfo(`Status: ${response.data.idp.data.overallProgress.status}`);
    logInfo(`Approved by manager: ${response.data.idp.data.approvedByManager}`);
    
    return response.data.idp;
  } catch (error) {
    logError(`IDP approval failed: ${error.message}`);
    throw error;
  }
}

async function updateProgress(idp, availablePrograms) {
  logStep(5, 'Development Progress Updates');
  
  // Find the first program from first goal that has a valid UUID
  const firstGoal = idp.data.developmentGoals[0];
  if (!firstGoal || !firstGoal.programs || firstGoal.programs.length === 0) {
    throw new Error('No programs found in the first development goal');
  }
  
  let targetProgram = null;
  
  // Look for a program with a valid UUID
  for (const program of firstGoal.programs) {
    if (program.programId && program.programId.length === 36) { // UUID length check
      targetProgram = program;
      break;
    }
  }
  
  // If no valid UUID found, try to map by name to available programs
  if (!targetProgram) {
    logInfo('No valid program UUID found, attempting to map by name...');
    
    for (const program of firstGoal.programs) {
      const matchingProgram = availablePrograms.find(p => 
        p.data.name === program.programName || 
        p.data.name.toLowerCase().includes(program.programName.toLowerCase())
      );
      
      if (matchingProgram) {
        targetProgram = {
          ...program,
          programId: matchingProgram.id
        };
        logSuccess(`Mapped program "${program.programName}" to UUID: ${matchingProgram.id}`);
        break;
      }
    }
  }
  
  if (!targetProgram) {
    // Create a fallback using any available program
    if (availablePrograms.length > 0) {
      targetProgram = {
        programId: availablePrograms[0].id,
        programName: availablePrograms[0].data.name,
        status: "Not Started",
        completionPercentage: 0
      };
      logInfo(`Using fallback program: ${targetProgram.programName} (${targetProgram.programId})`);
    } else {
      throw new Error('No available programs found for progress update');
    }
  }
  
  const progressData = {
    programId: targetProgram.programId,
    status: "In Progress",
    notes: `Started the program last week. Making good progress on ${targetProgram.programName}.`,
    completionPercentage: 25
  };
  
  logInfo(`Updating progress for program: ${targetProgram.programName} (${targetProgram.programId})`);
  
  try {
    const response = await makeRequest(`/api/idp/${idp.id}/progress`, {
      method: 'PUT',
      body: JSON.stringify(progressData)
    });
    
    logSuccess(`Progress updated for program: ${targetProgram.programName}`);
    logInfo(`Program status: ${progressData.status} (${progressData.completionPercentage}%)`);
    logInfo(`Overall IDP progress: ${response.data.idp.data.overallProgress.completionPercentage}%`);
    
    return response.data.idp;
  } catch (error) {
    logError(`Progress update failed: ${error.message}`);
    throw error;
  }
}

async function measureImpact() {
  logStep(6, 'Development Impact Measurement');
  
  try {
    const response = await makeRequest(`/api/idp/employees/${USER_ID}/impact`);
    
    logSuccess(`Impact measurement completed`);
    logInfo(`Overall improvement: ${response.data.impact.overallImpact.improvementPercentage}%`);
    logInfo(`Status: ${response.data.impact.overallImpact.status}`);
    
    // Log competency improvements
    response.data.impact.competencyImpacts.forEach(impact => {
      logInfo(`${impact.competency}: ${impact.improvementLevel} improvement`);
    });
    
    // Log key insights
    logInfo('\nKey Insights:');
    response.data.impact.insights.forEach(insight => {
      logInfo(`- ${insight}`);
    });
    
    return response.data.impact;
  } catch (error) {
    logError(`Impact measurement failed: ${error.message}`);
    throw error;
  }
}

async function saveTestResults(results) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `idp-test-results-${timestamp}.json`;
  
  await fs.writeFile(filename, JSON.stringify(results, null, 2));
  logSuccess(`Test results saved to: ${filename}`);
}

// Main test execution
async function runIDPEndToEndTest() {
  console.log('🚀 Starting IDP End-to-End Test');
  console.log('═'.repeat(60));
  console.log(`Target User ID: ${USER_ID}`);
  console.log(`Base URL: ${BASE_URL}`);
  
  const testResults = {
    userId: USER_ID,
    timestamp: new Date().toISOString(),
    steps: {},
    success: false,
    error: null
  };
  
  try {
    // Step 0: Setup development programs
    const programs = await setupDevelopmentPrograms();
    testResults.steps.setupPrograms = { success: true, data: programs };
    
    // Step 1: Gap Analysis
    const gapAnalysis = await performGapAnalysis();
    testResults.steps.gapAnalysis = { success: true, data: gapAnalysis };
    
    // Step 2: Nine-Box Mapping
    const nineBoxClassification = await performNineBoxMapping();
    testResults.steps.nineBoxMapping = { success: true, data: nineBoxClassification };
    
    // Step 3: IDP Generation
    const idp = await generateIDP();
    testResults.steps.idpGeneration = { success: true, data: idp };
    
    // Step 4: IDP Approval
    const approvedIDP = await approveIDP(idp);
    testResults.steps.idpApproval = { success: true, data: approvedIDP };
    
    // Step 5: Progress Updates (pass available programs for UUID mapping)
    const updatedIDP = await updateProgress(approvedIDP, programs);
    testResults.steps.progressUpdate = { success: true, data: updatedIDP };
    
    // Step 6: Impact Measurement
    const impactReport = await measureImpact();
    testResults.steps.impactMeasurement = { success: true, data: impactReport };
    
    testResults.success = true;
    
    console.log('\n🎉 IDP End-to-End Test COMPLETED SUCCESSFULLY!');
    console.log('═'.repeat(60));
    logSuccess('All workflow steps executed successfully');
    logInfo(`Final IDP Status: ${updatedIDP.data.overallProgress.status}`);
    logInfo(`Overall Progress: ${updatedIDP.data.overallProgress.completionPercentage}%`);
    logInfo(`Manager Approved: ${updatedIDP.data.approvedByManager}`);
    
  } catch (error) {
    testResults.success = false;
    testResults.error = error.message;
    
    console.log('\n💥 IDP End-to-End Test FAILED!');
    console.log('═'.repeat(60));
    logError(`Test failed with error: ${error.message}`);
    
    throw error;
  } finally {
    await saveTestResults(testResults);
  }
  
  return testResults;
}

// Health check before running tests
async function healthCheck() {
  try {
    const response = await makeRequest('/health');
    logSuccess('Server health check passed');
    return true;
  } catch (error) {
    logError(`Server health check failed: ${error.message}`);
    logError('Please ensure the server is running on http://localhost:3000');
    return false;
  }
}

// Run the test
async function main() {
  try {
    console.log('🏥 Performing health check...');
    const isHealthy = await healthCheck();
    
    if (!isHealthy) {
      process.exit(1);
    }
    
    await runIDPEndToEndTest();
    
    console.log('\n✨ Test execution completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n💥 Test execution failed:', error.message);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Test interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Test terminated');
  process.exit(1);
});

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runIDPEndToEndTest, healthCheck };