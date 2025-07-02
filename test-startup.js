#!/usr/bin/env node

/**
 * Simple test script to demonstrate startup dependency validation
 * This shows how the server fails fast when dependencies are not available
 */

console.log('🧪 Testing startup dependency validation...\n');

// Test 1: Missing DATABASE_URL (should fail)
console.log('📋 Test 1: Testing with missing DATABASE_URL');
const originalDbUrl = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;

try {
  // This should fail at startup validation
  await import('./dist/app.js').then(module => module.createApp());
  console.log('❌ UNEXPECTED: App started with missing DATABASE_URL');
} catch (error) {
  console.log('✅ EXPECTED: App correctly failed with missing DATABASE_URL');
  console.log(`   Error: ${error.message}\n`);
}

// Test 2: Invalid JWT_SECRET (should fail)
console.log('📋 Test 2: Testing with invalid JWT_SECRET');
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'too_short';
process.env.JWT_REFRESH_SECRET = 'this_is_a_longer_secret_that_meets_requirements';

try {
  await import('./dist/app.js').then(module => module.createApp());
  console.log('❌ UNEXPECTED: App started with invalid JWT_SECRET');
} catch (error) {
  console.log('✅ EXPECTED: App correctly failed with invalid JWT_SECRET');
  console.log(`   Error: ${error.message}\n`);
}

// Test 3: Same JWT secrets (should fail)
console.log('📋 Test 3: Testing with same JWT secrets');
process.env.JWT_SECRET = 'this_is_a_valid_jwt_secret_with_32_chars_minimum';
process.env.JWT_REFRESH_SECRET = 'this_is_a_valid_jwt_secret_with_32_chars_minimum'; // Same as access

try {
  await import('./dist/app.js').then(module => module.createApp());
  console.log('❌ UNEXPECTED: App started with same JWT secrets');
} catch (error) {
  console.log('✅ EXPECTED: App correctly failed with same JWT secrets');
  console.log(`   Error: ${error.message}\n`);
}

console.log('🎯 All startup validation tests completed!');
console.log('💡 To test successful startup, create a .env file with valid values and run: npm run dev'); 