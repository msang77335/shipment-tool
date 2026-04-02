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
  webshareApiKey?: string;
  webshareProxyMode: string;

  // Shopee session cookies (JSON array of Playwright Cookie objects)
  shopeeCookies?: string;

  // Shopee login credentials
  shopeeUsername?: string;
  shopeePassword?: string;

  // Shopee device fingerprint cookie
  shopeeSpcF?: string;

  // JNT Phone List
  jntPhoneList?: string;
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

/**
 * Parse JNT phone list from environment variable
 * Format: comma-separated list "phone1,phone2,phone3"
 * Example: "3942,0123456789"
 */
function parseJntPhoneList(): string[] {
  const jntPhoneEnv = process.env.JNT_PHONE_LIST || '';
  
  if (!jntPhoneEnv.trim()) {
    console.log('📞 [JNT PHONE LIST] No phone numbers configured');
    return [];
  }
  
  const phoneList = jntPhoneEnv
    .split(',')
    .map(phone => phone.trim())
    .filter(phone => phone.length > 0);
  
  console.log(`📞 [JNT PHONE LIST] Loaded ${phoneList.length} phone number(s)`);
  phoneList.forEach((phone, index) => {
    console.log(`   [${index + 1}] ${phone}`);
  });
  
  return phoneList;
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

    // Proxy Services
    proxies: parseProxies(),
    webshareApiKey: process.env.WEBSHARE_API_KEY || undefined,
    webshareProxyMode: process.env.WEBSHARE_PROXY_MODE || 'direct',

    // Shopee session cookies
    shopeeCookies: process.env.SHOPEE_SESSION_COOKIES || undefined,

    // Shopee login credentials
    shopeeUsername: process.env.SHOPEE_USERNAME || undefined,
    shopeePassword: process.env.SHOPEE_PASSWORD || undefined,

    // Shopee device fingerprint cookie
    shopeeSpcF: process.env.SHOPEE_SPC_F || undefined,

    // JNT Phone List - parse and log during initialization
    jntPhoneList: (() => {
      parseJntPhoneList(); // Call to log the phone list
      return process.env.JNT_PHONE_LIST || undefined;
    })(),
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
}); 