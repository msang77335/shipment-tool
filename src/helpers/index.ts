import { Page } from 'playwright';

export interface ScreenshotQuery {
  provider: string;
  codes: string;
}

// Environment Configuration
export { env, getEnv, getEnvVar, hasEnvVar, requireEnvVar, type EnvConfig } from './env';

// Browserless Token Rotator
export { 
  browserlessTokenRotator, 
  getNextBrowserlessToken, 
  hasBrowserlessTokens, 
  getBrowserlessTokenCount 
} from './browserlessTokenRotator';

// Gemini API Key Rotator
export {
  geminiApiKeyRotator,
  getNextGeminiApiKey,
  hasGeminiApiKeys,
  getGeminiApiKeyCount
} from './geminiApiKeyRotator';

export function isUSPS(providerStr: string) {
  return providerStr.toUpperCase().includes('USPS');
}

export function isSPX(providerStr: string) {
  return providerStr.toUpperCase().includes('SPX') || providerStr.toUpperCase().includes('SPX INTERNATIONAL');
}

export function isGiaoHangNhanh(providerStr: string) {
  return providerStr.toUpperCase().includes('GIAO HÀNG NHANH') || providerStr.toUpperCase().includes('GHN');
}

export function isJTExpress(providerStr: string) {
  return providerStr.toUpperCase().includes('J&T') || providerStr.toUpperCase().includes('JT EXPRESS');
}

export function isBestExpress(providerStr: string) {
  return providerStr.toUpperCase().includes('BEST EXPRESS');
}

export function isViettelPost(providerStr: string) {
  const upperStr = providerStr.toUpperCase();
  return upperStr.includes('VIETTEL POST') || upperStr.includes('VTP');
}

export function isVnPost(providerStr: string) {
  const upperStr = providerStr.toUpperCase();
  return upperStr.includes('VN POST') || upperStr.includes('VIETNAM POST');
}

export function isYunExpress(providerStr: string) {
  const upperStr = providerStr.toUpperCase();
  return upperStr.includes('YUN');
}

export function isYW(providerStr: string) {
  const upperStr = providerStr.toUpperCase();
  return upperStr.includes('YW');
}

export async function createPage(browserContext: any): Promise<Page> {
  const page = await browserContext.newPage();
  page.setDefaultTimeout(120000);
  console.log(`⏱️ [Helper] Default timeout set to 120 seconds`);
  return page;
}

export async function closePage(page: Page | undefined): Promise<void> {
  if (page && !page.isClosed()) {
    console.log(`🔄 [Helper] Closing page...`);
    await page.close().catch((e: any) => console.log('Error closing page:', e));
  }
}

export async function waitBeforeRetry(attempt: number): Promise<void> {
  const delay = attempt * 3000;
  console.log(`⏳ [Helper] Waiting ${delay}ms before retry...`);
  await new Promise(resolve => setTimeout(resolve, delay));
}

export async function captureLastAttemptScreenshot(page: Page, width = 1280, height = 1080): Promise<{ buffer: Buffer; status: string }> {
  const errorScreenshot = await page.screenshot({ fullPage: false, clip: { x: 0, y: 0, width, height } });
  console.error(`💥 [Helper] Final attempt failed, capturing error screenshot...`);
  await closePage(page);
  return { buffer: Buffer.from(errorScreenshot), status: 'UNKNOWN' };
}

export async function captureScreenshot(page: Page, width = 1280, height = 1080): Promise<Buffer> {
  console.log(`✅ [Helper] Tracking data found, taking screenshot...`);
  const screenshot = await page.screenshot({ fullPage: false, clip: { x: 0, y: 0, width, height } });
  console.log(`✅ [Helper] Screenshot captured, size: ${screenshot.length} bytes`);
  console.log(`✨ [Helper] All done!`);
  return Buffer.from(screenshot);
}
