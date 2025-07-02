import http from 'http';

const frameworkData = {
  jobTitle: 'Software Engineer',
  managerialCompetencies: [
    { name: 'Leadership', expectedLevel: 'Intermediate', description: 'Ability to lead a small team' },
    { name: 'Communication', expectedLevel: 'Advanced', description: 'Can communicate complex ideas clearly' }
  ],
  functionalCompetencies: [
    { name: 'Javascript', expectedLevel: 'Advanced', description: 'Deep knowledge of JS, including ES6+ features' },
    { name: 'Node.js', expectedLevel: 'Advanced', description: 'Can build and maintain complex back-end systems' },
    { name: 'Databases', expectedLevel: 'Intermediate', description: 'Experience with SQL and NoSQL databases' }
  ]
};

const employeeData = {
  employeeId: 'dev-001',
  employeeName: 'Alex Doe',
  currentJobTitle: 'Software Engineer',
  kpiScore: 85,
  performanceSummary: 'Exceeds expectations in most areas, particularly in code quality and feature delivery.',
  assessmentResults: {
    potentialScore: 90,
    summary: 'High potential for growth. Strong problem-solving skills and a quick learner.',
    competencyScores: [
      { competencyName: 'Leadership', score: 60 }, // Gap here
      { competencyName: 'Communication', score: 85 },
      { competencyName: 'Javascript', score: 90 },
      { competencyName: 'Node.js', score: 75 }, // Gap here
      { competencyName: 'Databases', score: 80 }
    ]
  }
};

const postData = JSON.stringify({
  frameworkData,
  employeeData
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/idp/gap-analysis',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

function pollForResult(employeeId, analysisId) {
  const pollOptions = {
    hostname: 'localhost',
    port: 3000,
    path: `/api/idp/gap-analysis/${employeeId}`,
    method: 'GET'
  };

  console.log(`\nPolling for result for employeeId: ${employeeId} (Analysis ID: ${analysisId})...`);

  const interval = setInterval(() => {
    const pollReq = http.request(pollOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          console.error(`Polling failed with status code: ${res.statusCode}`);
          console.error(data);
          clearInterval(interval);
          return;
        }

        const response = JSON.parse(data);
        const analysis = response.data.analysis;

        console.log(`Polling status: ${analysis.status}`);

        if (analysis.status === 'completed') {
          console.log('\n✅ Gap analysis completed successfully!');
          console.log(JSON.stringify(analysis, null, 2));
          clearInterval(interval);
        } else if (analysis.status === 'failed') {
          console.error('\n❌ Gap analysis failed!');
          console.error(JSON.stringify(analysis, null, 2));
          clearInterval(interval);
        }
      });
    });

    pollReq.on('error', (e) => {
      console.error(`Polling request error: ${e.message}`);
      clearInterval(interval);
    });

    pollReq.end();
  }, 5000); // Poll every 5 seconds
}

console.log('🚀 Starting IDP Gap Analysis E2E Test...');
console.log('Sending request to /api/idp/gap-analysis...');

const req = http.request(options, (res) => {
  console.log(`Initial response status: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode >= 400) {
      console.error('Request failed. Response:');
      console.error(data);
      return;
    }
    const response = JSON.parse(data);
    console.log('Initial response received:', response);
    if (response.success && response.data.analysisId) {
      pollForResult(employeeData.employeeId, response.data.analysisId);
    } else {
      console.error('Failed to initiate gap analysis.');
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
  console.error('\nPlease ensure the server is running on http://localhost:3000');
});

req.write(postData);
req.end(); 