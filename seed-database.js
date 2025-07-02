// Database seeding script
import 'dotenv/config';
import { createDatabaseConnection } from './dist/config/database.js';
import { getEnvironmentConfig } from './dist/config/environment.js';
import { createLogger } from './dist/config/logger.js';
import { seedRoleplayScenarios } from './dist/roleplay/seed.js';

async function seedDatabase() {
  try {
    const config = getEnvironmentConfig();
    const logger = createLogger(config);
    const db = createDatabaseConnection(config);
    
    console.log('🌱 Starting database seeding...');
    logger.info('Starting database seeding process');
    
    // Seed roleplay scenarios
    console.log('📚 Seeding roleplay scenarios...');
    await seedRoleplayScenarios(db, logger);
    console.log('✅ Roleplay scenarios seeded successfully!');
    
    console.log('✅ Database seeding completed successfully!');
    console.log('\n🎯 Ready to test the roleplay feature!');
    console.log('📝 Run the test script: node test-roleplay.js');
    console.log('🚀 Or start the server: npm start');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    console.error('\n🔍 Troubleshooting:');
    console.error('   1. Check your database connection');
    console.error('   2. Ensure environment variables are set');
    console.error('   3. Run database migrations if needed');
    console.error('   4. Check the error details above');
    process.exit(1);
  }
}

console.log('🚀 Pelajari Database Seeding');
console.log('============================');
seedDatabase(); 