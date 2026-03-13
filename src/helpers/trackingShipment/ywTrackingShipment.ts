import { Page } from "playwright";
import { captureLastAttemptScreenshot, captureScreenshot, closePage, createPage, waitBeforeRetry } from "..";
import { PlaywrightBrowserSingleton } from "../PlaywrightBrowserSingleton";

async function navigateAndTracking(page: Page, trackingURL: string, attempt: number, maxRetries: number) {
  console.log(`🌐 [YW] Navigating to yw56.com (attempt ${attempt}/${maxRetries})...`);
  await page.goto(trackingURL, {
    waitUntil: 'domcontentloaded'
  });
  console.log(`✅ [YW] Page loaded successfully`);
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log(`⌨️ [YW] Clicking search...`);
  await page.click('#search');

  console.log(`⏳ [YW] Waiting 15 seconds for content to load...`);
  await new Promise(resolve => setTimeout(resolve, 15000));
}

async function getShipmentStatus(page: Page): Promise<string> {
  console.log(`🔍 [YW] Extracting shipment status...`);
  return await page.evaluate(() => {
    const statusElement = (globalThis as any).document.querySelector('.cx_bt_xx p');
    const statusText = statusElement?.textContent?.trim() || '';

    if (statusText.toLowerCase().includes('delivered')) {
      return 'DELIVERED';
    }

    return 'UNKNOWN';
  });
}

async function checkTrackingData(page: Page): Promise<boolean> {
  console.log(`🔍 [YW] Checking for tracking data...`);
  return await page.evaluate(() => {
    const trackingDataElement = (globalThis as any).document.querySelector('.cx_bt_xx');
    if (!trackingDataElement) return false;
    const text = trackingDataElement.textContent?.toLowerCase() || '';
    return !text.includes('no information was found');
  });
}

async function attemptScreenshot({ page, codes, attempt, maxRetries }: { page: Page; codes: string; attempt: number; maxRetries: number; }): Promise<{ buffer: Buffer; status: string } | null> {
  const trackingURL = `https://track.yw56.com.cn/en/querydel?nums=${codes}`;
  await navigateAndTracking(page, trackingURL, attempt, maxRetries);
  const hasTrackingData = await checkTrackingData(page);

  if (hasTrackingData) {
    const status = await getShipmentStatus(page);

    console.log(`✅ [YW] Tracking data found: ${status}`);

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
      console.log(`🆕 [YW] Creating new page (attempt ${attempt}/${maxRetries})...`);
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
      console.error(`💥 [YW] Attempt ${attempt}/${maxRetries} failed:`, error.message);
      await closePage(page);
      if (attempt < maxRetries) {
        await waitBeforeRetry(attempt);
      }
    }
  }

  console.error(`💥 [AFTERSHIP] All ${maxRetries} attempts failed`);
  throw lastError || new Error('Failed to capture screenshot after all retries');
}

export async function ywTrackingShipment({ codes }: { codes: string }): Promise<{ status: string; buffer: Buffer }> {
  console.log(`📍 [YW] Starting screenshot for tracking: ${codes}`);

  const browserContext = await PlaywrightBrowserSingleton.getContext();
  if (!browserContext) {
    throw new Error('Failed to get browser context');
  }

  const maxRetries = 3;

  try {
    const { buffer, status } = await retryScreenshotCapture({ browserContext, codes, maxRetries });

    return {
      buffer,
      status: status ? 'DELIVERED' : 'UNKNOWN'
    };
  } catch (error) {
    console.error(`💥 [YW] Error in ywTrackingShipment:`, error);
    throw error;
  }
}