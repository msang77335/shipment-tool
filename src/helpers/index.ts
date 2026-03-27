import { Page } from 'playwright';

export interface ScreenshotQuery {
  provider: string;
  codes: string;
}

// Environment Configuration
export { env, getEnv, getEnvVar, hasEnvVar, requireEnvVar, type EnvConfig, type ProxyConfig } from './env';

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
  return providerStr.toUpperCase().includes('SPX') ||
    providerStr.toUpperCase().includes('SPX INTERNATIONAL') ||
    providerStr.toUpperCase().includes('ĐIỂM NHẬN HÀNG');
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

export function isOnTrac(providerStr: string) {
  const upperStr = providerStr.toUpperCase();
  return upperStr.includes('ONTRAC');
}

export function isUNIUNI(providerStr: string) {
  const upperStr = providerStr.toUpperCase();
  return upperStr.includes('UNIUNI');
}

export function isEVRI(providerStr: string) {
  const upperStr = providerStr.toUpperCase();
  return upperStr.includes('EVRI');
}

export function isASENDIA(providerStr: string) {
  const upperStr = providerStr.toUpperCase();
  return upperStr.includes('ASENDIA');
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
  if (page.isClosed()) {
    console.warn(`⚠️ [Helper] Page is already closed, cannot capture error screenshot`);
    return { buffer: Buffer.alloc(0), status: 'UNKNOWN' };
  }
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

export async function applyStealthPatches(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const nav = (globalThis as any).navigator;
    const win = globalThis as any;

    Object.defineProperty(nav, 'webdriver', { get: () => undefined });

    const pluginList: any[] = [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
    ];
    Object.defineProperty(pluginList, 'item', { value: (i: number) => pluginList[i] });
    Object.defineProperty(pluginList, 'namedItem', { value: (n: string) => pluginList.find((p) => p.name === n) ?? null });
    Object.defineProperty(pluginList, 'refresh', { value: () => {} });
    Object.defineProperty(nav, 'plugins', { get: () => pluginList });

    Object.defineProperty(nav, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(nav, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(nav, 'languages', { get: () => ['en-US', 'en'] });

    const markers = ['__playwright', '__pwInitScripts', '__pw_manual', '_phantom', '__nightmare', 'callPhantom', '__webdriver_script_fn', '__selenium_unwrapped'];
    markers.forEach((k) => { try { delete win[k]; } catch { /* ignore */ } });
  });
}


const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

export async function setStealthHeaders(page: Page): Promise<void> {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
  });
  console.log(`🥸 [Stealth] UA: ${ua.slice(0, 60)}...`);
}
