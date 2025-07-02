# Pelajari Backend

A Node.js learning management system backend built with **functional programming principles** and **enterprise-grade dependency injection** with startup validation.

## 🏗️ Architecture

### Dependency Injection with Startup Validation

This application implements **fail-fast dependency injection** - the server will **NOT start** if any critical dependency is unavailable.

#### Key Features:
- ✅ **Environment validation** before startup
- ✅ **Database health checks** with connection testing  
- ✅ **JWT secret validation** (length, uniqueness)
- ✅ **External service health checks** (configurable)
- ✅ **Timeout handling** for all dependency checks
- ✅ **Parallel validation** for fast startup
- ✅ **Detailed logging** of dependency status

### Functional Programming Architecture

```
Environment Config → Logger, Database, Utils
Database + Logger → Repositories  
Repositories + Utils + Logger → Services
Services + Logger → Handlers
All Dependencies → Express App (only if validation passes)
```

#### 3-Layer Architecture:
- **Handlers**: HTTP request/response handling, validation, formatting
- **Services**: Business logic, authentication, user management
- **Repositories**: Data access, database operations

## 🚀 Quick Start

### 1. Environment Setup

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` with your actual values:
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://username:password@localhost:5432/pelajari_be
JWT_SECRET=your_super_secure_jwt_secret_at_least_32_characters_long
JWT_REFRESH_SECRET=different_super_secure_refresh_secret_32_chars_min
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
LOG_LEVEL=info
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

**If any critical dependency is unhealthy, the server will refuse to start:**

```
🔍 Performing startup dependency validation...
❌ STARTUP FAILED: Critical dependencies are not available
FATAL: Critical dependencies failed - startup aborted
  criticalFailures: [
    "database: Connection timeout",
    "jwt-secrets: JWT_SECRET must be at least 32 characters long"
  ]
```

## 🧪 Testing Dependency Validation

Test the startup validation system:

```bash
npm run build
node test-startup.js
```

This will test various failure scenarios:
- Missing DATABASE_URL
- Invalid JWT_SECRET length
- Duplicate JWT secrets

## 📡 API Endpoints

### Health Check
```http
GET /health
```

### Authentication
```http
POST /auth/register     # User registration
POST /auth/login        # User login
POST /auth/refresh      # Token refresh
```

### User Management
```http
PUT  /auth/users/:userId/password    # Change password
PUT  /auth/users/:userId/profile     # Update profile
GET  /auth/users/:userId/profile     # Get profile
DELETE /auth/users/:userId           # Deactivate account
```

### Manager Operations
```http
PUT  /auth/users/:userId/manager     # Assign manager
GET  /auth/managers/:managerId/users # Get team members
PUT  /auth/users/:userId/role        # Update user role
```

## 🔧 Dependency Injection Details

### 1. Factory Functions
Every component is created via factory functions with explicit dependencies:

```typescript
// Repository creation
const authRepository = createAuthRepository(db, logger);

// Service creation (depends on repository)
const authService = createAuthService({
  authRepository,
  logger,
  jwtUtils,
  passwordUtils,
});
```

### 2. Startup Validation
Before creating any business logic, all dependencies are validated:

```typescript
const validationResult = await performStartupValidation(db, config, logger);

if (!validationResult.success) {
  logger.fatal('❌ STARTUP FAILED: Critical dependencies are not available');
  process.exit(1); // Fail fast!
}
```

### 3. Dependency Health Checks

Each dependency has a health check with timeout:

```typescript
const dependencies: DependencyCheck[] = [
  {
    name: 'database',
    critical: true,
    timeout: 5000,
    check: () => checkDatabaseHealth(db)
  },
  {
    name: 'jwt-secrets',
    critical: true,
    timeout: 1000,
    check: () => validateJWTSecrets(config)
  }
];
```

### 4. Benefits

- **🚀 Fail Fast**: Server won't start with broken dependencies
- **🧪 Testable**: Easy to mock dependencies for testing
- **🔍 Observable**: Detailed logging of dependency status
- **⚡ Performance**: Parallel validation for fast startup
- **🛡️ Type Safe**: Full TypeScript type checking
- **📦 No Global State**: All dependencies explicitly injected

## 🏗️ Adding New Dependencies

To add a new dependency check:

```typescript
// In src/config/startup.ts
function createRedisHealthCheck(redisClient: Redis): DependencyCheck {
  return {
    name: 'redis',
    critical: true,
    timeout: 3000,
    check: async () => {
      await redisClient.ping();
      return true;
    },
  };
}

// Add to performStartupValidation
const dependencies: DependencyCheck[] = [
  createEnvironmentCheck(config),
  createDatabaseHealthCheck(db),
  createRedisHealthCheck(redis), // Your new dependency
];
```

## 📁 Project Structure

```
src/
├── config/
│   ├── environment.ts    # Environment validation
│   ├── database.ts       # Database connection & health
│   ├── logger.ts         # Structured logging
│   └── startup.ts        # Dependency validation system
├── shared/
│   ├── middleware/       # Express middleware
│   └── utils/           # Utility functions
├── auth/                # Authentication domain
│   ├── auth.handlers.ts  # HTTP handlers (controllers)
│   ├── auth.services.ts  # Business logic
│   ├── auth.repositories.ts # Data access
│   └── auth.schemas.ts   # Validation schemas
├── db/
│   └── schema.ts        # Database schema
├── app.ts              # Application assembly with DI
└── server.ts           # Server entry point
```

## 🔧 Development

### Build
```bash
npm run build
```

### Start Production
```bash
npm start
```

### Database Migrations
```bash
npm run db:generate
npm run db:migrate
```

## 📋 Features

- ✅ Functional programming (no classes, only functions)
- ✅ Dependency injection with startup validation
- ✅ Database health checks
- ✅ JWT authentication with validation
- ✅ Request/response validation with Zod
- ✅ Structured logging with correlation IDs
- ✅ Error handling middleware
- ✅ TypeScript with strict settings
- ✅ Fail-fast startup validation
- ✅ Graceful shutdown handling

---

**The server will only start when ALL critical dependencies are healthy!** 🎯 