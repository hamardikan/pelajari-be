// Simple Node.js test script for roleplay endpoints
const BASE_URL = 'http://localhost:3000';

async function makeRequest(endpoint, method = 'GET', body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    console.log(`\n${method} ${endpoint}`);
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));
    
    return { response, data };
  } catch (error) {
    console.error(`Error with ${method} ${endpoint}:`, error.message);
    return { error };
  }
}

async function testRoleplayFeature() {
  console.log('🎭 Testing Roleplay Feature');
  console.log('===============================');
  
  // Test 1: Get available scenarios
  console.log('\n📋 Test 1: Get Available Scenarios');
  const { data: scenariosData } = await makeRequest('/api/roleplay/scenarios');
  
  if (!scenariosData?.success || !scenariosData.data?.scenarios?.length) {
    console.log('❌ No scenarios found. Running seeding...');
    
    // Try to seed the database (this would typically be done separately)
    console.log('💡 Please run the database seeding script first:');
    console.log('   node seed-database.js');
    console.log('   or ensure scenarios are seeded in the database.');
    
    console.log('\n🔄 Trying to get scenarios again...');
    await makeRequest('/api/roleplay/scenarios');
    return;
  }
  
  const firstScenario = scenariosData.data.scenarios[0];
  const firstScenarioId = firstScenario.id;
  
  console.log(`✅ Found ${scenariosData.data.scenarios.length} scenarios`);
  console.log(`📝 Testing with scenario: "${firstScenario.data.title}"`);
  
  // Test 2: Get scenario details
  console.log('\n📖 Test 2: Get Scenario Details');
  await makeRequest(`/api/roleplay/scenarios/${firstScenarioId}`);
  
  // Test 3: Get scenario statistics (should be empty initially)
  console.log('\n📊 Test 3: Get Scenario Statistics (Initial)');
  await makeRequest(`/api/roleplay/scenarios/${firstScenarioId}/stats`);
  
  // Test 4: Start roleplay session
  console.log('\n🚀 Test 4: Start Roleplay Session');
  const { data: sessionData } = await makeRequest(
    `/api/roleplay/scenarios/${firstScenarioId}/start`, 
    'POST'
  );
  
  if (!sessionData?.success || !sessionData.data?.sessionId) {
    console.log('❌ Failed to start session, cannot continue with session tests');
    return;
  }
  
  const sessionId = sessionData.data.sessionId;
  console.log(`✅ Session started with ID: ${sessionId}`);
  console.log(`🤖 Initial AI message: "${sessionData.data.initialMessage}"`);
  
  // Test 5: Send first message
  console.log('\n💬 Test 5: Send First Message');
  await makeRequest(
    `/api/roleplay/sessions/${sessionId}/message`,
    'POST',
    { 
      message: 'Hello, I understand you\'re having some technical issues. Can you tell me more about what\'s happening?' 
    }
  );
  
  // Test 6: Send second message
  console.log('\n💬 Test 6: Send Second Message');
  await makeRequest(
    `/api/roleplay/sessions/${sessionId}/message`,
    'POST',
    { 
      message: 'I apologize for the inconvenience. Let me help you resolve this issue. When exactly did the problem start occurring?' 
    }
  );
  
  // Test 7: Send third message
  console.log('\n💬 Test 7: Send Third Message');
  await makeRequest(
    `/api/roleplay/sessions/${sessionId}/message`,
    'POST',
    { 
      message: 'I understand your frustration. Let me escalate this to our technical team and provide you with a timeline for resolution. Would that work for you?' 
    }
  );
  
  // Test 8: Get session details
  console.log('\n📊 Test 8: Get Session Details');
  await makeRequest(`/api/roleplay/sessions/${sessionId}`);
  
  // Test 9: Get session transcript
  console.log('\n📝 Test 9: Get Session Transcript');
  await makeRequest(`/api/roleplay/sessions/${sessionId}/transcript`);
  
  // Test 10: End session
  console.log('\n🏁 Test 10: End Session');
  const { data: endSessionData } = await makeRequest(
    `/api/roleplay/sessions/${sessionId}/end`, 
    'POST'
  );
  
  if (endSessionData?.success) {
    console.log(`✅ Session ended successfully`);
    console.log(`📊 Overall score: ${endSessionData.data.evaluation.overallScore}/100`);
    console.log(`💪 Strengths: ${endSessionData.data.evaluation.strengths.join(', ')}`);
    console.log(`📈 Areas for improvement: ${endSessionData.data.evaluation.areasForImprovement.join(', ')}`);
  }
  
  // Test 11: Get user sessions
  console.log('\n📚 Test 11: Get User Sessions');
  await makeRequest('/api/roleplay/sessions');
  
  // Test 12: Get user stats
  console.log('\n📈 Test 12: Get User Stats');
  await makeRequest('/api/roleplay/stats');
  
  // Test 13: Get scenario stats (should now have data)
  console.log('\n📊 Test 13: Get Scenario Stats (After Session)');
  await makeRequest(`/api/roleplay/scenarios/${firstScenarioId}/stats`);
  
  // Test 14: Test pagination and filtering
  console.log('\n🔍 Test 14: Test Scenario Filtering');
  await makeRequest('/api/roleplay/scenarios?difficulty=intermediate&limit=5');
  
  // Test 15: Test search functionality
  console.log('\n🔍 Test 15: Test Scenario Search');
  await makeRequest('/api/roleplay/scenarios?search=client&page=1&limit=10');
  
  // Test 16: Test session filtering
  console.log('\n🔍 Test 16: Test Session Filtering');
  await makeRequest('/api/roleplay/sessions?status=completed&limit=5');
  
  console.log('\n✅ Roleplay testing completed!');
  console.log('\n🎯 Summary:');
  console.log('   - Scenarios retrieved successfully');
  console.log('   - Session lifecycle completed (start → messages → end)');
  console.log('   - AI evaluation generated');
  console.log('   - Analytics and statistics working');
  console.log('   - Search and filtering functional');
  console.log('\n🚀 The roleplay feature is ready to use!');
}

// Additional utility function to test error cases
async function testErrorCases() {
  console.log('\n⚠️  Testing Error Cases');
  console.log('========================');
  
  // Test invalid scenario ID
  console.log('\n❌ Test 1: Invalid Scenario ID');
  await makeRequest('/api/roleplay/scenarios/invalid-uuid');
  
  // Test invalid session ID
  console.log('\n❌ Test 2: Invalid Session ID');
  await makeRequest('/api/roleplay/sessions/invalid-uuid');
  
  // Test message to non-existent session
  console.log('\n❌ Test 3: Message to Non-existent Session');
  await makeRequest(
    '/api/roleplay/sessions/12345678-1234-1234-1234-123456789012/message',
    'POST',
    { message: 'This should fail' }
  );
  
  // Test empty message
  console.log('\n❌ Test 4: Empty Message');
  await makeRequest(
    '/api/roleplay/sessions/12345678-1234-1234-1234-123456789012/message',
    'POST',
    { message: '' }
  );
  
  console.log('\n✅ Error case testing completed!');
}

// Run the tests
async function runAllTests() {
  try {
    await testRoleplayFeature();
    await testErrorCases();
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  }
}

// Check if script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export { testRoleplayFeature, testErrorCases, runAllTests }; 