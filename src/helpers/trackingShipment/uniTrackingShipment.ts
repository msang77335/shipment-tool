import { Page } from "playwright";
import { captureLastAttemptScreenshot, captureScreenshot, closePage, createPage, waitBeforeRetry } from "..";
import { PlaywrightBrowserSingleton } from "../browser/PlaywrightBrowserSingleton";

async function navigateAndTracking(page: Page, trackingURL: string, codes: string, attempt: number, maxRetries: number) {
  console.log(`🌐 [UNIUNI] Navigating to uniuni.com (attempt ${attempt}/${maxRetries})...`);
  await page.goto(trackingURL, {
    waitUntil: 'domcontentloaded'
  });
  console.log(`✅ [UNIUNI] Page loaded successfully`);
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log(`⌨️ [UNIUNI] Entering tracking code...`);
  await page.fill('#input-track', codes);

  console.log(`⌨️ [UNIUNI] Clicking Track button...`);
  await page.click('.track-btn');

  console.log(`⏳ [UNIUNI] Waiting 10 seconds for content to load...`);
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log(`🖱️ [UNIUNI] Clicking overview div to open detail...`);
  await page.click('.overview');

  console.log(`⏳ [UNIUNI] Waiting for detail to be visible...`);
  await page.waitForSelector('.detail-list', { state: 'visible', timeout: 10000 });

  await new Promise(resolve => setTimeout(resolve, 5000));
}

async function getShipmentStatus(page: Page): Promise<string> {
  console.log(`🔍 [UNIUNI] Extracting shipment status...`);
  return await page.evaluate(() => {
    const statusElement = (globalThis as any).document.querySelector('.status-overview');
    const statusText = statusElement?.textContent?.trim() || '';

    if (statusText.toLowerCase().includes('delivered')) {
      return 'DELIVERED';
    }

    return 'UNKNOWN';
  });
}

async function checkTrackingData(page: Page): Promise<boolean> {
  console.log(`🔍 [UNIUNI] Checking for tracking data...`);
  return await page.evaluate(() => {
    const hasTrackingList = (globalThis as any).document.querySelector('.tracking-list');
    return !!hasTrackingList;
  });
}

async function attemptScreenshot({ page, codes, attempt, maxRetries }: { page: Page; codes: string; attempt: number; maxRetries: number; }): Promise<{ buffer: Buffer; status: string } | null> {
  const trackingURL = 'https://www.uniuni.com/tracking/';
  await navigateAndTracking(page, trackingURL, codes, attempt, maxRetries);
  const hasTrackingData = await checkTrackingData(page);

  if (hasTrackingData) {
    const status = await getShipmentStatus(page);

    console.log(`✅ [UNIUNI] Tracking data found: ${status}`);

    const buffer = await captureScreenshot(page, 1400, 900);
    return { buffer, status };
  }

  return null;
}

async function retryScreenshotCapture({ browserContext, codes, maxRetries }: { browserContext: any; codes: string; maxRetries: number; }): Promise<{ buffer: Buffer; status: string }> {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let page: Page | undefined;
    try {
      console.log(`🆕 [UNIUNI] Creating new page (attempt ${attempt}/${maxRetries})...`);
      page = await createPage(browserContext);

      const result = await attemptScreenshot({ page, codes, attempt, maxRetries });

      if (result) {
        await closePage(page);
        return result;
      }

      if (attempt < maxRetries) {
        await closePage(page);
        await waitBeforeRetry(attempt);
      } else {
        return await captureLastAttemptScreenshot(page, 1400, 900);
      }
    } catch (error: any) {
      lastError = error;
      console.error(`💥 [UNIUNI] Attempt ${attempt}/${maxRetries} failed:`, error.message);
      await closePage(page);
      if (attempt < maxRetries) {
        await waitBeforeRetry(attempt);
      }
    }
  }

  console.error(`💥 [UNIUNI] All ${maxRetries} attempts failed`);
  throw lastError || new Error('Failed to capture screenshot after all retries');
}

export async function uniTrackingShipment({ codes }: { codes: string }): Promise<{ status: string; buffer: Buffer }> {
  console.log(`📍 [UNIUNI] Starting screenshot for tracking: ${codes}`);

  const browserContext = await PlaywrightBrowserSingleton.getContextWithoutProxy();
  if (!browserContext) {
    throw new Error('Failed to get browser context');
  }

  const maxRetries = 3;

  try {
    const { buffer, status } = await retryScreenshotCapture({ browserContext, codes, maxRetries });

    return {
      buffer,
      status: status === 'DELIVERED' ? 'DELIVERED' : 'UNKNOWN'
    };
  } catch (error) {
    console.error(`💥 [UNIUNI] Error in uniTrackingShipment:`, error);
    throw error;
  }
}