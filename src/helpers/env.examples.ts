/**
 * Environment Helper Usage Examples
 * 
 * This file demonstrates how to use the env helper throughout the project
 */

import { env, getEnvVar, hasEnvVar, requireEnvVar } from '@/helpers/env';

// ============================================
// Example 1: Using the singleton env instance
// ============================================

export function setupServer() {
  console.log(`🚀 Starting server in ${env.nodeEnv} mode`);
  console.log(`📡 Server will listen on port ${env.port}`);
  console.log(`🔗 API prefix: ${env.apiPrefix}`);
  
  if (env.isDevelopment) {
    console.log('🔧 Development mode enabled - verbose logging active');
  }
  
  if (env.isProduction) {
    console.log('🏭 Production mode - optimizations enabled');
  }
}

// ============================================
// Example 2: Checking if API keys are configured
// ============================================

export function getCaptchaSolver() {
  if (env.captchaSolverApiKey) {
    console.log('🔐 Captcha solver configured');
    return initializeCaptchaSolver(env.captchaSolverApiKey);
  }
  
  console.log('⚠️ Captcha solver not configured');
  return null;
}

function initializeCaptchaSolver(apiKey: string) {
  // Initialize captcha solver with API key
  return { apiKey };
}

// ============================================
// Example 3: Using getEnvVar for custom variables
// ============================================

export function getCustomConfig() {
  // Get a custom environment variable with default
  const timeout = getEnvVar('REQUEST_TIMEOUT', '30000');
  const maxRetries = getEnvVar('MAX_RETRIES', '3');
  
  return {
    timeout: Number.parseInt(timeout, 10),
    maxRetries: Number.parseInt(maxRetries, 10),
  };
}

// ============================================
// Example 4: Using hasEnvVar to check existence
// ============================================

export function checkOptionalFeatures() {
  const features = {
    captcha: hasEnvVar('CAPTCHA_SOLVER_API_KEY'),
    gemini: hasEnvVar('GEMINI_API_KEY'),
    browserless: hasEnvVar('BROWSERLESS_API_TOKEN'),
  };
  
  console.log('📊 Optional features:', features);
  return features;
}

// ============================================
// Example 5: Using requireEnvVar for critical config
// ============================================

export function initializeCriticalService() {
  try {
    // This will throw if the variable is not set
    const apiKey = requireEnvVar('CRITICAL_API_KEY');
    console.log('✅ Critical API key found');
    return { apiKey };
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

// ============================================
// Example 6: Conditional logic based on environment
// ============================================

export function getLogLevel() {
  if (env.isDevelopment) {
    return 'debug';
  }
  
  if (env.isProduction) {
    return 'error';
  }
  
  return 'info';
}

// ============================================
// Example 7: Using in Playwright configuration
// ============================================

export function getBrowserConfig() {
  return {
    headless: env.isProduction,
    slowMo: env.isDevelopment ? 100 : 0,
    devtools: env.isDevelopment,
    timeout: env.isDevelopment ? 60000 : 30000,
  };
}

// ============================================
// Example 8: Database connection configuration
// ============================================

export function getDatabaseConfig() {
  const dbHost = getEnvVar('DB_HOST', 'localhost');
  const dbPort = getEnvVar('DB_PORT', '5432');
  const dbName = getEnvVar('DB_NAME', 'shipment_tracking');
  
  return {
    host: dbHost,
    port: Number.parseInt(dbPort, 10),
    database: dbName,
    ssl: env.isProduction,
  };
}

// ============================================
// Example 9: API client configuration
// ============================================

export function getApiClientConfig() {
  return {
    baseURL: env.apiPrefix,
    timeout: 30000,
    headers: {
      'User-Agent': `ShipmentTracker/${env.nodeEnv}`,
    },
    validateStatus: env.isDevelopment
      ? undefined
      : (status: number) => status < 500,
  };
}

// ============================================
// Example 10: Replacing direct process.env usage
// ============================================

// ❌ Bad - Direct process.env access
function badExample() {
  const port = process.env.PORT || 8080;
  const apiKey = process.env.GEMINI_API_KEY || '';
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Dev mode');
  }
}

// ✅ Good - Using env helper
function goodExample() {
  const port = env.port;
  const apiKey = env.geminiApiKey || '';
  
  if (env.isDevelopment) {
    console.log('Dev mode');
  }
}
