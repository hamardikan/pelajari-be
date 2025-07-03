# Pelajari Platform - API Documentation

## Overview

Pelajari is a comprehensive learning and development platform that leverages AI to create personalized learning experiences, conduct competency gap analyses, and facilitate skill development through interactive roleplay scenarios.

### Base URL
```
http://localhost:3000
```

### Authentication
The API uses JWT (JSON Web Tokens) for authentication. Include the access token in the Authorization header:
```
Authorization: Bearer <access_token>
```

### Response Format
All API responses follow a consistent format:
```json
{
  "success": boolean,
  "message": string,
  "data": object | array,
  "correlationId": string,
  "timestamp": string
}
```

### Error Handling
Error responses include additional error information:
```json
{
  "success": false,
  "message": string,
  "error": {
    "type": string,
    "details": object
  },
  "correlationId": string,
  "timestamp": string
}
```

---

## Authentication Endpoints

### Register User
Create a new user account.

**POST** `/auth/register`

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "SecurePassword123!",
  "role": "user",
  "managerId": "uuid-optional"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "role": "user",
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

### Login User
Authenticate and receive access tokens.

**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "role": "user"
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

### Refresh Token
Get new access token using refresh token.

**POST** `/auth/refresh`

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

### Update User Profile
Update user profile information.

**PUT** `/auth/users/{userId}/profile`

**Request Body:**
```json
{
  "name": "John Smith",
  "profileData": {
    "bio": "Learning enthusiast",
    "skills": ["JavaScript", "Python"],
    "goals": ["Master AI", "Learn Cloud Computing"]
  }
}
```

---

## Document Management

### Upload Document
Upload a document for processing into learning modules.

**POST** `/api/documents`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file`: PDF or DOCX file (max 10MB)
- `title`: Document title
- `description`: Optional description
- `tags`: Optional array of tags

**Response:**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "document": {
      "id": "uuid",
      "title": "Training Manual",
      "originalFilename": "manual.pdf",
      "fileType": "pdf",
      "uploadedBy": "user-id",
      "uploadedAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

### Get Documents
Retrieve paginated list of documents.

**GET** `/api/documents`

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 50)
- `search`: Search term
- `fileType`: Filter by file type (pdf, docx, txt, pptx)
- `uploadedBy`: Filter by uploader user ID

**Response:**
```json
{
  "success": true,
  "data": {
    "documents": [...],
    "total": 25,
    "page": 1,
    "limit": 10
  }
}
```

### Get Document
Retrieve specific document details.

**GET** `/api/documents/{documentId}`

### Update Document
Update document metadata.

**PUT** `/api/documents/{documentId}`

**Request Body:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "tags": ["new", "tags"]
}
```

### Delete Document
Delete a document.

**DELETE** `/api/documents/{documentId}`

### Get Document Content
Get document content or signed URL.

**GET** `/api/documents/{documentId}/content`

---

## Learning Module Management

### Create Module from File
Generate learning module from uploaded file using AI.

**POST** `/api/learning/modules`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file`: PDF or DOCX file

**Response:**
```json
{
  "success": true,
  "message": "Module creation initiated",
  "data": {
    "moduleId": "uuid",
    "documentId": "uuid",
    "status": "processing",
    "message": "Module creation initiated"
  }
}
```

### Get Learning Modules
Retrieve paginated list of learning modules.

**GET** `/api/learning/modules`

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `search`: Search term
- `difficulty`: Filter by difficulty (beginner, intermediate, advanced)

**Response:**
```json
{
  "success": true,
  "data": {
    "modules": [
      {
        "id": "uuid",
        "title": "JavaScript Fundamentals",
        "summary": "Learn the basics of JavaScript programming...",
        "difficulty": "beginner",
        "estimatedDuration": 120,
        "tags": ["programming", "javascript"],
        "isPublished": true,
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "total": 15,
    "page": 1,
    "limit": 10
  }
}
```

### Get Learning Module
Retrieve specific learning module with full content.

**GET** `/api/learning/modules/{moduleId}`

**Response:**
```json
{
  "success": true,
  "data": {
    "module": {
      "id": "uuid",
      "title": "JavaScript Fundamentals",
      "summary": "Comprehensive guide to JavaScript...",
      "difficulty": "beginner",
      "estimatedDuration": 120,
      "content": {
        "sections": [...],
        "flashcards": [
          {
            "term": "Variable",
            "definition": "A container for storing data values"
          }
        ],
        "assessment": [
          {
            "question": "What is a variable?",
            "options": ["A", "B", "C", "D"],
            "correctAnswer": "A",
            "explanation": "Variables store data values"
          }
        ],
        "evaluation": [...]
      }
    }
  }
}
```

### Delete Learning Module
Delete a learning module.

**DELETE** `/api/learning/modules/{moduleId}`

---

## Learning Progress Management

### Start Module
Begin learning a module.

**POST** `/api/learning/modules/{moduleId}/start`

**Response:**
```json
{
  "success": true,
  "message": "Module started successfully",
  "data": {
    "progress": {
      "id": "uuid",
      "userId": "uuid",
      "moduleId": "uuid",
      "progress": {
        "status": "in_progress",
        "completionPercentage": 0,
        "currentSectionIndex": 0,
        "startedAt": "2025-01-01T00:00:00.000Z",
        "timeSpent": 0
      }
    }
  }
}
```

### Update Progress
Update learning progress.

**PUT** `/api/learning/progress`

**Request Body:**
```json
{
  "moduleId": "uuid",
  "sectionIndex": 1,
  "completed": false,
  "timeSpent": 300
}
```

### Get User Progress
Get progress for specific module.

**GET** `/api/learning/modules/{moduleId}/progress`

### Get User Progress List
Get all user progress records.

**GET** `/api/learning/progress`

**Query Parameters:**
- `status`: Filter by status (not_started, in_progress, completed)

---

## Assessment & Evaluation

### Submit Assessment
Submit answers for module assessment.

**POST** `/api/learning/assessments`

**Request Body:**
```json
{
  "moduleId": "uuid",
  "answers": ["A", "B", "C", "D", "A"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "score": 4,
    "totalQuestions": 5,
    "percentage": 80,
    "feedback": [
      {
        "questionIndex": 0,
        "correct": true,
        "explanation": "Correct! Variables store data values."
      }
    ]
  }
}
```

### Submit Evaluation
Submit response for evaluation question.

**POST** `/api/learning/evaluations`

**Request Body:**
```json
{
  "moduleId": "uuid",
  "questionIndex": 0,
  "response": "In this scenario, I would first assess the situation..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "score": 85,
    "feedback": "Good analysis of the situation...",
    "suggestions": [
      "Consider stakeholder impact",
      "Develop contingency plans",
      "Communicate proactively"
    ]
  }
}
```

---

## Individual Development Plan (IDP)

### Competency Gap Analysis (One-Shot IDP Generation)
Perform complete IDP generation in a single operation: analyzes competency gaps, maps talent to 9-box grid, and generates Individual Development Plan.

**POST** `/api/idp/gap-analysis`

**Content-Type:** `multipart/form-data` or `application/json`

#### Option 1: File Upload
**Form Data:**
- `frameworkFile`: PDF/DOCX file containing competency framework
- `employeeFile`: PDF/DOCX file containing employee data
- `employeeId`: Optional employee UUID

#### Option 2: JSON Payload
**Request Body:**
```json
{
  "frameworkData": {
    "jobTitle": "Software Developer",
    "managerialCompetencies": [
      { "name": "Team Leadership", "description": "Ability to lead and guide team members" }
    ],
    "functionalCompetencies": [
      {
        "name": "JavaScript Programming",
        "expectedLevel": "Advanced",
        "description": "Expert-level JavaScript development skills"
      }
    ]
  },
  "employeeData": {
    "employeeName": "John Doe",
    "currentJobTitle": "Junior Developer",
    "performanceSummary": "Shows strong technical skills but needs leadership development...",
    "kpiScore": 75,
    "assessmentResults": {
      "potentialScore": 80,
      "summary": "High potential employee with growth opportunities",
      "competencyScores": [
        {
          "competencyName": "JavaScript Programming",
          "score": 70
        }
      ]
    }
  }
}
```

#### PDF File Requirements:
- **Framework PDF**: Should contain job descriptions, required competencies, skill levels, and performance expectations
- **Employee PDF**: Should contain performance reviews, assessment results, competency evaluations, and skill assessments
- **File Size**: Maximum 10MB per file
- **Format**: PDF files with readable text (not scanned images)

**Response:**
```json
{
  "success": true,
  "message": "Gap analysis and IDP generation initiated successfully",
  "data": {
    "analysisId": "uuid",
    "idpId": "uuid",
    "status": "completed",
    "message": "Gap analysis and IDP generation completed successfully"
  }
}
```

### Get Gap Analysis
Retrieve gap analysis results.

**GET** `/api/idp/gap-analysis/{employeeId}`

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis": {
      "id": "uuid",
      "employeeName": "John Doe",
      "jobTitle": "Software Developer",
      "gaps": [
        {
          "competency": "Team Leadership",
          "category": "managerial",
          "requiredLevel": "Intermediate",
          "currentLevel": "Basic",
          "gapLevel": 1,
          "description": "Needs development in team leadership skills",
          "priority": "High"
        }
      ],
      "overallGapScore": 65,
      "recommendations": [
        "Enroll in leadership training program",
        "Seek mentoring opportunities"
      ]
    }
  }
}
```

### Map Talent to 9-Box Grid
Classify employee on 9-Box Grid.

**POST** `/api/idp/employees/{employeeId}/nine-box`

**Request Body:**
```json
{
  "kpiScore": 85,
  "assessmentScore": 78
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "classification": "Key Player"
  }
}
```

### Generate IDP
Create comprehensive development plan.

> **Note:** IDP generation is now automatically included in the one-shot gap analysis process. This endpoint can still be used if you want to regenerate an IDP for an employee who already has a gap analysis.

**POST** `/api/idp/generate/{employeeId}`

**Response:**
```json
{
  "success": true,
  "message": "IDP generation initiated successfully",
  "data": {
    "idpId": "uuid",
    "status": "completed",
    "message": "IDP generated successfully"
  }
}
```

### Get IDP
Retrieve individual development plan.

**GET** `/api/idp/employees/{employeeId}`

**Response:**
```json
{
  "success": true,
  "data": {
    "idp": {
      "id": "uuid",
      "employeeName": "John Doe",
      "title": "Individual Development Plan - John Doe",
      "nineBoxClassification": "Key Player",
      "developmentGoals": [
        {
          "id": "goal-1",
          "competency": "Team Leadership",
          "currentLevel": "Basic",
          "targetLevel": "Intermediate",
          "priority": "High",
          "timeframe": "6 months",
          "programs": [
            {
              "programId": "uuid",
              "programName": "Leadership Fundamentals",
              "type": "Training",
              "status": "Not Started",
              "completionPercentage": 0
            }
          ],
          "successMetrics": [
            "Successfully lead 2 projects",
            "Receive positive team feedback"
          ]
        }
      ],
      "overallProgress": {
        "status": "Draft",
        "completionPercentage": 0
      }
    }
  }
}
```

### Approve IDP
Manager approval of development plan.

**PUT** `/api/idp/{idpId}/approve`

**Request Body:**
```json
{
  "managerId": "uuid",
  "comments": "Approved with focus on leadership development"
}
```

### Update IDP Progress
Track progress on development programs.

**PUT** `/api/idp/{idpId}/progress`

**Request Body:**
```json
{
  "programId": "uuid",
  "status": "In Progress",
  "completionPercentage": 50,
  "notes": "Making good progress on leadership skills"
}
```

### Measure IDP Impact
Assess the effectiveness of development programs.

**GET** `/api/idp/employees/{employeeId}/impact`

**Response:**
```json
{
  "success": true,
  "data": {
    "impact": {
      "employeeId": "uuid",
      "overallImpact": {
        "previousGapScore": 65,
        "currentGapScore": 45,
        "improvementPercentage": 30,
        "status": "Significant Improvement"
      },
      "competencyImpacts": [...],
      "insights": [...],
      "recommendations": [...]
    }
  }
}
```

### List Gap Analyses
Retrieve all competency gap analyses created by the authenticated user, or optionally those for a specific employee.

**GET** `/api/idp/gap-analysis`

**Query Parameters:**
- `employeeId` *(optional)*: Filter analyses for a specific employee UUID.

**Response:**
```json
{
  "success": true,
  "data": {
    "analyses": [
      {
        "id": "uuid",
        "employeeId": "uuid-of-employee",
        "jobTitle": "Project Manager",
        "overallGapScore": 69,
        "createdAt": "2025-07-03T08:45:58.000Z"
      }
    ]
  }
}
```

Access rules:
• Returns all records where `createdBy` equals the current user.
• If `employeeId` is supplied, results are further filtered by that employee.

---

## Roleplay Scenarios

### Get Available Scenarios
Retrieve list of published roleplay scenarios.

**GET** `/api/roleplay/scenarios`

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `difficulty`: Filter by difficulty
- `search`: Search term
- `competency`: Filter by target competency

**Response:**
```json
{
  "success": true,
  "data": {
    "scenarios": [
      {
        "id": "uuid",
        "title": "Handling a Difficult Client",
        "description": "Practice managing challenging customer interactions",
        "difficulty": "intermediate",
        "estimatedDuration": 15,
        "targetCompetencies": ["communication", "empathy", "problem-solving"],
        "tags": ["customer-service", "conflict-resolution"]
      }
    ],
    "total": 10,
    "page": 1,
    "limit": 10
  }
}
```

### Get Scenario Details
Get complete scenario information.

**GET** `/api/roleplay/scenarios/{scenarioId}`

**Response:**
```json
{
  "success": true,
  "data": {
    "scenario": {
      "id": "uuid",
      "title": "Handling a Difficult Client",
      "description": "Practice managing challenging customer interactions",
      "difficulty": "intermediate",
      "estimatedDuration": 15,
      "targetCompetencies": ["communication", "empathy"],
      "scenario": {
        "context": "You are a customer service representative...",
        "setting": "Phone call during business hours",
        "yourRole": "Senior Customer Service Representative",
        "aiRole": "Frustrated Client (Alex Thompson)",
        "objectives": [
          "Acknowledge the client's frustration",
          "Gather detailed information",
          "Provide clear action plan"
        ],
        "successCriteria": [
          "Client feels heard and understood",
          "Professional tone maintained"
        ]
      }
    }
  }
}
```

---

## Roleplay Sessions

### Start Roleplay Session
Begin a new roleplay session.

**POST** `/api/roleplay/scenarios/{scenarioId}/start`

**Response:**
```json
{
  "success": true,
  "message": "Roleplay session started successfully",
  "data": {
    "sessionId": "uuid",
    "initialMessage": "Hello, this is Alex Thompson. I've been having issues with your software for over a week now and I'm really frustrated...",
    "status": "active"
  }
}
```

### Send Message
Send a message in active roleplay session.

**POST** `/api/roleplay/sessions/{sessionId}/message`

**Request Body:**
```json
{
  "message": "I understand your frustration, Mr. Thompson. Let me help you resolve this issue right away."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "messageId": "uuid",
    "aiResponse": "Thank you for understanding. The issue is with generating monthly reports - the system crashes every time I try...",
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
}
```

### End Session
Complete roleplay session and get evaluation.

**POST** `/api/roleplay/sessions/{sessionId}/end`

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "evaluation": {
      "overallScore": 85,
      "competencyScores": {
        "communication": 90,
        "problem-solving": 80,
        "empathy": 85
      },
      "strengths": [
        "Excellent active listening skills",
        "Professional tone throughout",
        "Clear action plan provided"
      ],
      "areasForImprovement": [
        "Could probe deeper for technical details",
        "Opportunity to set better expectations"
      ],
      "detailedFeedback": "You demonstrated strong customer service skills...",
      "recommendations": [
        "Practice technical troubleshooting questions",
        "Work on setting realistic timelines"
      ]
    },
    "status": "completed"
  }
}
```

### Get Session Details
Retrieve session information.

**GET** `/api/roleplay/sessions/{sessionId}`

### Get User Sessions
Get user's roleplay session history.

**GET** `/api/roleplay/sessions`

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `status`: Filter by status (active, completed, abandoned)
- `scenarioId`: Filter by scenario

### Get Session Transcript
Get full conversation history.

**GET** `/api/roleplay/sessions/{sessionId}/transcript`

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "uuid",
        "timestamp": "2025-01-01T00:00:00.000Z",
        "sender": "ai",
        "content": "Hello, this is Alex Thompson..."
      },
      {
        "id": "uuid",
        "timestamp": "2025-01-01T00:01:00.000Z",
        "sender": "user",
        "content": "I understand your frustration..."
      }
    ],
    "scenario": {
      "title": "Handling a Difficult Client",
      "description": "Practice managing challenging customer interactions"
    }
  }
}
```

---

## Development Programs

### Get Development Programs
Retrieve available development programs.

**GET** `/api/idp/programs`

**Response:**
```json
{
  "success": true,
  "data": {
    "programs": [
      {
        "id": "uuid",
        "name": "Leadership Fundamentals",
        "type": "Training",
        "description": "Core leadership skills development",
        "duration": "2 weeks",
        "targetCompetencies": ["leadership", "communication"],
        "difficulty": "Intermediate",
        "format": "Online",
        "isActive": true
      }
    ]
  }
}
```

### Create Development Program
Add new development program.

**POST** `/api/idp/programs`

**Request Body:**
```json
{
  "name": "Advanced JavaScript",
  "type": "Training",
  "description": "Advanced JavaScript programming concepts",
  "duration": "4 weeks",
  "targetCompetencies": ["javascript", "programming"],
  "difficulty": "Advanced",
  "format": "Online",
  "cost": 299
}
```

---

## Analytics & Statistics

### Get Module Statistics
Retrieve learning module analytics.

**GET** `/api/learning/modules/{moduleId}/stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalUsers": 150,
      "completedUsers": 120,
      "averageProgress": 85,
      "averageTimeSpent": 180
    }
  }
}
```

### Get User Learning Statistics
Get user's learning analytics.

**GET** `/api/learning/stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalModules": 25,
      "completedModules": 18,
      "inProgressModules": 5,
      "totalTimeSpent": 3600
    }
  }
}
```

### Get Scenario Statistics
Retrieve roleplay scenario analytics.

**GET** `/api/roleplay/scenarios/{scenarioId}/stats`

### Get User Roleplay Statistics
Get user's roleplay analytics.

**GET** `/api/roleplay/stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalSessions": 15,
      "completedSessions": 12,
      "averageScore": 78,
      "totalTimeSpent": 240
    }
  }
}
```

---

## Health Check

### System Health
Check system status and dependencies.

**GET** `/health`

**Response:**
```json
{
  "success": true,
  "message": "Service is healthy",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

## Error Codes

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | VALIDATION_ERROR | Invalid request data |
| 401 | AUTHENTICATION_ERROR | Missing or invalid authentication |
| 403 | AUTHORIZATION_ERROR | Insufficient permissions |
| 404 | NOT_FOUND_ERROR | Resource not found |
| 422 | BUSINESS_LOGIC_ERROR | Business rule violation |
| 500 | INTERNAL_SERVER_ERROR | Server error |
| 502 | EXTERNAL_SERVICE_ERROR | External service unavailable |

---

## Rate Limiting

- **Authentication endpoints**: 5 requests per minute per IP
- **File uploads**: 10 requests per hour per user
- **AI processing**: 3 concurrent requests per user
- **General API**: 100 requests per minute per user

---

## SDK Examples

### JavaScript/Node.js
```javascript
const response = await fetch('/api/learning/modules', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
```

### Python
```python
import requests

headers = {
    'Authorization': f'Bearer {access_token}',
    'Content-Type': 'application/json'
}

response = requests.get('/api/learning/modules', headers=headers)
data = response.json()
```

---

## Webhooks

### Learning Module Completion
Triggered when a user completes a learning module.

**Payload:**
```json
{
  "event": "module.completed",
  "userId": "uuid",
  "moduleId": "uuid",
  "completedAt": "2025-01-01T00:00:00.000Z",
  "score": 85
}
```

### IDP Status Change
Triggered when IDP status changes.

**Payload:**
```json
{
  "event": "idp.status_changed",
  "idpId": "uuid",
  "employeeId": "uuid",
  "previousStatus": "Draft",
  "newStatus": "Active",
  "changedAt": "2025-01-01T00:00:00.000Z"
}
```