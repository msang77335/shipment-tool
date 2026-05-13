/**
 * Environment Configuration Helper
 * Centralized environment variable management with type safety and defaults
 */

import dotenv from 'dotenv';
dotenv.config();

export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

export interface EnvConfig {
  // Environment
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
  
  // Server
  port: number;
  apiPrefix: string;
  trustProxy: string;
  xApiKey?: string;
  
  // Captcha Services
  captchaSolverApiKey?: string;
  captcha2CaptchaKey?: string;
  captchaAnticaptchaKey?: string;
  
  // AI Services
  geminiApiKey?: string;
  googleAiApiKey?: string;
  
  // Browser Services
  browserlessApiToken?: string;

  // Proxy Services
  proxies: ProxyConfig[];

  // Webshare Proxy Mode
  webshareApiKey?: string;
  webshareProxyMode: string;

  // Feature Flags
  aftershipEnabled: boolean;
}

/**
 * Parse proxy list from environment variable
 * Format: "ip:port:username:password|ip:port:username:password|..."
 * Example: "31.59.20.176:6754:jdlxhaek:rmkr551esb7x|23.95.150.145:6114:jdlxhaek:rmkr551esb7x"
 */
function parseProxies(): ProxyConfig[] {
  const proxyEnv = process.env.PROXY_LIST || '';
  
  if (!proxyEnv.trim()) {
    console.log('🔄 [PROXY] No proxies configured (PROXY_LIST is empty)');
    return [];
  }
  
  const proxies = proxyEnv.split('|').map(proxy => {
    const [ip, port, username, password] = proxy.split(':');
    return {
      server: `http://${ip}:${port}`,
      username: username || undefined,
      password: password || undefined,
    };
  }).filter(p => p.server);
  
  console.log(`🔄 [PROXY] Loaded ${proxies.length} proxy(ies)`);
  proxies.forEach((proxy, index) => {
    const auth = proxy.username ? ` (${proxy.username})` : '';
    console.log(`   [${index + 1}] ${proxy.server}${auth}`);
  });
  
  return proxies;
}

export function getEnv(): EnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  return {
    // Environment
    nodeEnv,
    isDevelopment: nodeEnv === 'development',
    isProduction: nodeEnv === 'production',
    
    // Server
    port: Number.parseInt(process.env.PORT || '8080', 10),
    apiPrefix: process.env.API_PREFIX || '/api/v1',
    trustProxy: process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal',    
    // Captcha Services
    captchaSolverApiKey: process.env.CAPTCHA_SOLVER_API_KEY || undefined,
    
    // AI Services
    geminiApiKey: process.env.GEMINI_API_KEY || undefined,
    
    // Browser Services
    browserlessApiToken: process.env.BROWSERLESS_API_TOKEN || undefined,

    // API Key for accessing the API
    xApiKey: process.env.X_API_KEY || undefined,

    webshareApiKey: process.env.WEBSHARE_API_KEY || undefined,
    webshareProxyMode: process.env.WEBSHARE_PROXY_MODE || 'direct',
    proxies: parseProxies(),

    // Feature Flags
    aftershipEnabled: process.env.AFTERSHIP_ENABLED === 'true',
  };
}

/**
 * Get a specific environment variable with optional default
 */
export function getEnvVar(key: string, defaultValue?: string): string {
  return process.env[key] || defaultValue || '';
}

/**
 * Check if environment variable exists
 */
export function hasEnvVar(key: string): boolean {
  return !!process.env[key];
}

/**
 * Require an environment variable (throws if not set)
 */
export function requireEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ Required environment variable ${key} is not set`);
  }
  return value;
}

// Export singleton instance
export const env = getEnv();

console.log('✅ Environment configuration loaded:', {
  nodeEnv: env.nodeEnv,
  port: env.port,
  apiPrefix: env.apiPrefix,
  trustProxy: env.trustProxy,
  hasCaptchaSolverApiKey: !!env.captchaSolverApiKey,
  hasGeminiApiKey: !!env.geminiApiKey,
  hasBrowserlessApiToken: !!env.browserlessApiToken,
  hasXApiKey: !!env.xApiKey,
  webShareApiKey: !!env.webshareApiKey,
}); 