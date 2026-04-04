import { snakeCase } from 'lodash';
import { Page } from 'playwright';
import { applyStealthPatches, ScreenshotQuery, setStealthHeaders } from '..';
import { PlaywrightBrowserSingleton } from '../browser/PlaywrightBrowserSingleton';

const USPS_TRACKING_URL = (codes: string) =>
  `https://tools.usps.com/go/TrackConfirmAction?tRef=fullpage&tLc=2&text28777=&tLabels=${encodeURIComponent(codes)}&tABt=true`;


async function waitForTrackingData(page: Page): Promise<boolean> {
  console.log(`🔍 [USPS] Waiting for tracking results to appear...`);
  try {
    await page.waitForSelector(
      '.tracking-progress-bar-status-container, .tb-step.current-step, .latest-update-banner-wrapper',
      { timeout: 30000 },
    );
    console.log(`✅ [USPS] Tracking data element found`);
    return true;
  } catch {
    console.log(`⚠️ [USPS] Tracking data element not found within timeout`);
    return false;
  }
}

async function checkBotDetected(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const url = (globalThis as any).window.location.href;
    const title = (globalThis as any).document.title || '';
    const body = (globalThis as any).document.body?.textContent || '';
    return (
      url.includes('outage_apology') ||
      url.includes('anyapp_outage_apology') ||
      title.toLowerCase().includes('outage') ||
      body.toLowerCase().includes('experiencing difficulties')
    );
  });
}

async function getShipmentStatus(page: Page): Promise<string> {
  const detailText = await page.evaluate(() => {
    const doc = (globalThis as any).document;

    const container = doc.querySelector('.tracking-progress-bar-status-container');
    if (container?.classList?.contains('delivered-status')) return 'DELIVERED';

    const tbStatus = doc.querySelector('.tb-step.current-step .tb-status');
    const tbStatusText = tbStatus?.textContent?.trim() || '';
    if (/delivered/i.test(tbStatusText)) return 'DELIVERED';

    const tbDetail = doc.querySelector('.tb-step.current-step .tb-status-detail');
    const detailText = tbDetail?.textContent?.trim() || '';
    if (detailText) return detailText;

    const banner = doc.querySelector('.latest-update-banner-wrapper .banner-content');
    const bannerText = banner?.textContent?.trim() || '';
    if (/delivered/i.test(bannerText)) return 'DELIVERED';

    return 'UNKNOWN';
  });

  if (detailText && detailText !== 'DELIVERED' && detailText !== 'UNKNOWN') {
    return snakeCase(detailText).toUpperCase();
  }

  return detailText;
}

/** Visit USPS homepage first to warm up cookies — reduces bot-score significantly */
async function warmUpCookies(page: Page): Promise<void> {
  console.log(`🍪 [USPS] Warming up cookies via usps.com...`);
  try {
    await page.goto('https://www.usps.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000 + Math.floor(Math.random() * 1500)));
    console.log(`✅ [USPS] Cookie warm-up complete`);
  } catch (err: any) {
    console.log(`⚠️ [USPS] Cookie warm-up failed (non-fatal): ${err.message}`);
  }
}

async function attemptUSPS(page: Page, codes: string, attempt: number, maxRetries: number): Promise<{ buffer: Buffer; status: string } | null> {
  const url = USPS_TRACKING_URL(codes);
  console.log(`🌐 [USPS] Navigating to USPS tracking (attempt ${attempt}/${maxRetries})...`);

  let botDetectedViaXhr = false;
  const requestListener = (req: any) => {
    if (req.url().includes('outage_apology')) {
      botDetectedViaXhr = true;
      console.log(`⚠️ [USPS] Bot detection XHR detected: ${req.url()}`);
    }
  };
  page.on('request', requestListener);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (err: any) {
    console.log(`⚠️ [USPS] Navigation error (non-fatal): ${err.message}`);
  }

  await new Promise(r => setTimeout(r, 3000));

  page.off('request', requestListener);

  const vp = page.viewportSize() || { width: 1280, height: 800 };
  await page.setViewportSize({ width: vp.width + 1, height: vp.height + 1 });
  await new Promise(r => setTimeout(r, 300));
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await new Promise(r => setTimeout(r, 500));

  const botDetected = botDetectedViaXhr || await checkBotDetected(page);
  if (!botDetected) {
    const bodyLength = await page.evaluate(() => ((globalThis as any).document.body?.innerHTML || '').trim().length);
    if (bodyLength < 200) {
      console.log(`⚠️ [USPS] Page body is nearly empty (${bodyLength} chars), likely bot-blocked blank page`);
      return null;
    }
  }
  if (botDetected) {
    console.log(`⚠️ [USPS] Bot detection triggered, page redirected to apology page`);
    return null;
  }

  const hasData = await waitForTrackingData(page);
  if (!hasData) {
    console.log(`⚠️ [USPS] No tracking data found on attempt ${attempt}`);
    return null;
  }

  await new Promise(r => setTimeout(r, 2000));

  // Remove navigation menu elements before screenshot
  await page.evaluate(() => {
    const doc = (globalThis as any).document;
    const menuElements = doc.querySelectorAll('ul[role="menu"]');
    menuElements.forEach((el: any) => {
      if (el.parentElement) {
        el.remove();
      }
    });
  });

  await new Promise(r => setTimeout(r, 3000));

  const status = await getShipmentStatus(page);
  console.log(`📊 [USPS] Status: ${status}`);

  const screenshot = await page.screenshot({ fullPage: false });
  console.log(`📸 [USPS] Screenshot taken, size: ${screenshot.length} bytes`);

  return { buffer: Buffer.from(screenshot), status };
}

async function runAttempt(codes: string, attempt: number, maxRetries: number): Promise<{ buffer: Buffer; status: string } | null> {
  const context = await PlaywrightBrowserSingleton.getContextWithoutProxy();
  if (!context) throw new Error('Failed to get Playwright context');

  const page = await context.newPage();
  if (!page) throw new Error('Failed to create Playwright page');

  try {
    await applyStealthPatches(page);
    await setStealthHeaders(page);
    if (attempt === 1) await warmUpCookies(page);

    return await attemptUSPS(page, codes, attempt, maxRetries);
  } finally {
    await page.close();
  }
}

export async function uspsTrackingShipment({ codes }: Pick<ScreenshotQuery, 'codes'>): Promise<{ status: string; buffer: Buffer }> {
  console.log(`🚀 [USPS] Starting USPS tracking for: ${codes}`);

  const maxRetries = 5;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await runAttempt(codes, attempt, maxRetries);
      if (result) {
        console.log(`✅ [USPS] Success on attempt ${attempt}`);
        return result;
      }
    } catch (err: any) {
      lastError = err;
      console.error(`💥 [USPS] Attempt ${attempt} error: ${err.message}`);
    }

    if (attempt < maxRetries) {
      const delay = attempt * 5000;
      console.log(`⏳ [USPS] Waiting ${delay}ms before retry...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  console.error(`💥 [USPS] All ${maxRetries} attempts failed`);
  throw lastError || new Error('Failed to capture USPS tracking screenshot after all retries');
}
