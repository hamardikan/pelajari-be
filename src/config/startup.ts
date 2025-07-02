import type { Logger } from 'pino';
import type { Database } from './database.js';
import { checkDatabaseHealth } from './database.js';
import type { EnvironmentConfig } from './environment.js';
import { createOpenRouterClient } from '../shared/utils/openrouter.js';
import { createR2Client } from '../shared/utils/r2.js';

export type DependencyCheck = {
  name: string;
  check: () => Promise<boolean>;
  critical: boolean;
  timeout?: number;
};

export type StartupValidationResult = {
  success: boolean;
  results: Array<{
    name: string;
    status: 'healthy' | 'unhealthy' | 'timeout';
    critical: boolean;
    duration: number;
    error?: string;
  }>;
  criticalFailures: string[];
};

async function validateSingleDependency(
  dependency: DependencyCheck,
  logger: Logger
): Promise<{
  name: string;
  status: 'healthy' | 'unhealthy' | 'timeout';
  critical: boolean;
  duration: number;
  error?: string;
}> {
  const startTime = Date.now();
  const timeout = dependency.timeout || 10000; // Default 10 second timeout
  
  try {
    logger.info({ dependency: dependency.name }, 'Checking dependency health');
    
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), timeout);
    });
    
    // Race between health check and timeout
    const isHealthy = await Promise.race([
      dependency.check(),
      timeoutPromise
    ]);
    
    const duration = Date.now() - startTime;
    
    if (isHealthy) {
      logger.info({ 
        dependency: dependency.name, 
        duration,
        critical: dependency.critical 
      }, 'Dependency is healthy');
      
      return {
        name: dependency.name,
        status: 'healthy',
        critical: dependency.critical,
        duration,
      };
    } else {
      logger.error({ 
        dependency: dependency.name, 
        duration,
        critical: dependency.critical 
      }, 'Dependency is unhealthy');
      
      return {
        name: dependency.name,
        status: 'unhealthy',
        critical: dependency.critical,
        duration,
        error: 'Health check returned false',
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const isTimeout = error instanceof Error && error.message === 'Health check timeout';
    const status = isTimeout ? 'timeout' : 'unhealthy';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error({ 
      dependency: dependency.name, 
      error: errorMessage,
      duration,
      critical: dependency.critical,
      timeout: isTimeout
    }, `Dependency check ${status}`);
    
    return {
      name: dependency.name,
      status,
      critical: dependency.critical,
      duration,
      error: errorMessage,
    };
  }
}

async function validateAllDependencies(
  dependencies: DependencyCheck[],
  logger: Logger
): Promise<StartupValidationResult> {
  logger.info({ totalDependencies: dependencies.length }, 'Starting dependency validation');
  
  const startTime = Date.now();
  
  // Run all dependency checks in parallel
  const results = await Promise.all(
    dependencies.map(dep => validateSingleDependency(dep, logger))
  );
  
  const totalDuration = Date.now() - startTime;
  
  // Find critical failures
  const criticalFailures = results
    .filter(result => result.critical && result.status !== 'healthy')
    .map(result => `${result.name}: ${result.error || result.status}`);
  
  const success = criticalFailures.length === 0;
  
  // Log summary
  const healthyCount = results.filter(r => r.status === 'healthy').length;
  const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
  const timeoutCount = results.filter(r => r.status === 'timeout').length;
  
  if (success) {
    logger.info({
      totalDuration,
      healthy: healthyCount,
      unhealthy: unhealthyCount,
      timeouts: timeoutCount,
      criticalFailures: criticalFailures.length
    }, 'All critical dependencies are healthy - startup can proceed');
  } else {
    logger.fatal({
      totalDuration,
      healthy: healthyCount,
      unhealthy: unhealthyCount,
      timeouts: timeoutCount,
      criticalFailures,
    }, 'Critical dependencies failed - startup aborted');
  }
  
  return {
    success,
    results,
    criticalFailures,
  };
}

function createDatabaseHealthCheck(db: Database): DependencyCheck {
  return {
    name: 'database',
    critical: true,
    timeout: 5000,
    check: () => checkDatabaseHealth(db),
  };
}

function createEnvironmentCheck(config: EnvironmentConfig): DependencyCheck {
  return {
    name: 'environment',
    critical: true,
    timeout: 1000,
    check: async () => {
      // Check that all critical environment variables are present
      const requiredVars = [
        'DATABASE_URL',
        'JWT_SECRET',
        'JWT_REFRESH_SECRET'
      ];
      
      for (const varName of requiredVars) {
        const value = config[varName as keyof EnvironmentConfig];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          throw new Error(`Missing required environment variable: ${varName}`);
        }
      }
      
      return true;
    },
  };
}

function createJWTSecretValidationCheck(config: EnvironmentConfig): DependencyCheck {
  return {
    name: 'jwt-secrets',
    critical: true,
    timeout: 1000,
    check: async () => {
      if (config.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters long');
      }
      
      if (config.JWT_REFRESH_SECRET.length < 32) {
        throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
      }
      
      if (config.JWT_SECRET === config.JWT_REFRESH_SECRET) {
        throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different');
      }
      
      return true;
    },
  };
}

// Example external service health check
function createExternalServiceCheck(
  serviceName: string,
  url: string,
  critical: boolean = false
): DependencyCheck {
  return {
    name: `external-service-${serviceName}`,
    critical,
    timeout: 8000,
    check: async () => {
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(7000)
        });
        return response.ok;
      } catch (error) {
        throw new Error(`External service ${serviceName} is unreachable: ${error}`);
      }
    },
  };
}

function createOpenRouterHealthCheck(config: EnvironmentConfig, logger: Logger): DependencyCheck {
  return {
    name: 'openrouter-api',
    critical: true,
    timeout: 8000,
    check: async () => {
      const client = createOpenRouterClient({
        apiKey: config.OPENROUTER_API_KEY,
        siteUrl: config.SITE_URL,
        siteName: config.SITE_NAME,
      }, logger.child({ component: 'openrouter-health' }));
      return client.testConnection();
    },
  };
}

function createR2HealthCheck(config: EnvironmentConfig, logger: Logger): DependencyCheck {
  return {
    name: 'cloudflare-r2',
    critical: true,
    timeout: 8000,
    check: async () => {
      const r2Client = createR2Client({
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
        bucketName: config.R2_BUCKET_NAME,
        accountId: config.R2_ACCOUNT_ID,
      }, logger.child({ component: 'r2-health' }));
      return r2Client.testConnection();
    },
  };
}

async function performStartupValidation(
  db: Database,
  config: EnvironmentConfig,
  logger: Logger
): Promise<StartupValidationResult> {
  const dependencies: DependencyCheck[] = [
    createEnvironmentCheck(config),
    createJWTSecretValidationCheck(config),
    createDatabaseHealthCheck(db),
    createOpenRouterHealthCheck(config, logger),
    createR2HealthCheck(config, logger),
    // Add more dependency checks as needed
    // createExternalServiceCheck('auth-service', 'https://auth.example.com/health', false),
  ];
  
  return validateAllDependencies(dependencies, logger);
}

export {
  validateAllDependencies,
  validateSingleDependency,
  createDatabaseHealthCheck,
  createEnvironmentCheck,
  createJWTSecretValidationCheck,
  createExternalServiceCheck,
  createOpenRouterHealthCheck,
  createR2HealthCheck,
  performStartupValidation,
}; 