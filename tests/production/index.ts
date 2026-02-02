/**
 * Production Test Suite Index
 * 
 * This file exports all production test utilities and runs all tests.
 * 
 * Usage:
 *   npm run test:production          # Run all production tests
 *   npm run test:prod:db             # Database tests only
 *   npm run test:prod:api            # API tests only
 *   npm run test:prod:voice          # Voice tests only (caution: incurs charges)
 *   npm run test:prod:all            # All tests with full flags
 * 
 * Environment variables:
 *   RUN_DB_TESTS=1     Enable database tests
 *   RUN_API_TESTS=1    Enable API tests
 *   RUN_VOICE_TESTS=1  Enable voice tests (costs money!)
 *   RUN_AI_TESTS=1     Enable AI service tests
 */

export * from './setup'
