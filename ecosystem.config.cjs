module.exports = {
  apps: [
    {
      name: 'pelajari-be',
      script: 'dist/server.js', // built entry point (run `npm run build` first)

      // Optimized for t3.small (2 vCPUs, 2GB RAM)
      instances: 1,
      exec_mode: 'cluster',

      // Environment variables (production values)
      env: {
        NODE_ENV: 'production',
        PORT: 80,

        // Database
        DATABASE_URL: 'postgresql://postgres.ffsowrgusdejismvrpgw:PQUdlUy67NfrTImy@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
        DB_POOL_MIN: 2,
        DB_POOL_MAX: 10,

        // JWT
        JWT_SECRET: 'vPOUoN6jjSdcQkR45gp49axMiUjhOwV9k8oeVFO1YF8=',
        JWT_REFRESH_SECRET: '/2Hhn/LQLFH9VHj1nZHCE46x3l9qsN75ezua4ZAEPa8=',
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',

        // Logging & resilience
        LOG_LEVEL: 'info',
        RETRY_ATTEMPTS: 3,
        CIRCUIT_BREAKER_THRESHOLD: 5,
        CIRCUIT_BREAKER_TIMEOUT: 60000,

        // OpenRouter
        OPENROUTER_API_KEY: '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',
        SITE_URL: 'https://hamardikan.my.id',
        SITE_NAME: 'Pelajari',

        // Cloudflare R2
        R2_ACCESS_KEY_ID: 'fdc9bb2acfb646adfa282747574ff875',
        R2_SECRET_ACCESS_KEY: 'e9c0cab7f5a676bc61c2e85fd28270418adfd4a4c83ba2496617e1448e2e44d7',
        R2_BUCKET_NAME: 'pelajari',
        R2_ACCOUNT_ID: 'd284c2d65712f728caf7bc833593de40',
        R2_CONNECTION_STRING: 'https://d284c2d65712f728caf7bc833593de40.r2.cloudflarestorage.com/pelajari',
        R2_PUBLIC_URL: 'https://hamardikan.my.id'
      }
    }
  ]
};