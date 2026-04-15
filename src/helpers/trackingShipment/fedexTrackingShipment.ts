import { Browser, Page } from "puppeteer";
import { waitBeforeRetry } from "..";
import { PuppeteerBrowserSingleton } from "../browser/PuppeteerBrowserSingleton";


/** Hide the FEDEX cookie consent dialog */
async function hideCookieDialog(page: Page): Promise<void> {
  try {
    // Fallback: hide the dialog if button not found
    const dialog = await page.$('#usercentrics-cmp-ui');
    if (dialog) {
      await page.evaluate((el) => {
        if (el) {
          (el as any).style.display = 'none';
        }
      }, dialog);
      console.log(`✅ [FEDEX] Cookie dialog hidden via CSS`);
    }
  } catch (err: any) {
    console.log(`⚠️ [FEDEX] Failed to hide cookie dialog: ${err.message}`);
  }
}

async function navigateAndTracking(page: Page, trackingURL: string, codes: string, attempt: number, maxRetries: number) {
  console.log(`🌐 [FEDEX] Navigating to fedex.com (attempt ${attempt}/${maxRetries})...`);
  await page.goto(trackingURL, {
    waitUntil: 'domcontentloaded'
  });

  console.log(`⏳ [FEDEX] Waiting 15 seconds for content to load...`);
  await new Promise(resolve => setTimeout(resolve, 15000));
}

async function checkTrackingData(page: Page): Promise<boolean> {
  console.log(`🔍 [FEDEX] Checking for tracking data...`);
  const pageContent = await page.$('.track-shared-wrapper');

  if (pageContent) {
    await hideCookieDialog(page);
  }

  return !!pageContent;
}


async function getShipmentStatus(page: Page): Promise<string> {
  console.log(`🔍 [FEDEX] Extracting shipment status...`);
  return await page.evaluate(() => {
    const statusElement = (globalThis as any).document.querySelector('#status_delivered');
    const statusText = statusElement?.textContent?.trim() || '';

    if (statusText.toLowerCase().includes('delivered')) {
      return 'DELIVERED';
    }

    return 'UNKNOWN';
  });
}

async function attemptScreenshot({ page, codes, attempt, maxRetries }: { page: Page; codes: string; attempt: number; maxRetries: number; }): Promise<{ buffer: Buffer; status: string } | null> {
  const trackingURL = `https://www.fedex.com/fedextrack/?trknbr=${codes}`;
  await navigateAndTracking(page, trackingURL, codes, attempt, maxRetries);

  const hasTrackingData = await checkTrackingData(page);

  if (hasTrackingData) {
    const status = await getShipmentStatus(page);

    console.log(`✅ [FEDEX] Tracking data found: ${status}`);

    const buffer = await page.screenshot({ fullPage: false, clip: { x: 0, y: 0, width: 1180, height: 800 } }) as Buffer;
    return { buffer, status };
  }

  return null;
}

async function retryScreenshotCapture({ browserContext, codes, maxRetries }: { browserContext: Browser; codes: string; maxRetries: number; }): Promise<{ buffer: Buffer; status: string }> {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let page: Page | undefined;
    try {
      console.log(`🆕 [FEDEX] Creating new page (attempt ${attempt}/${maxRetries})...`);
      page = await browserContext.newPage();
      if (!page) {
        throw new Error('Failed to create page');
      }

      const result = await attemptScreenshot({ page, codes, attempt, maxRetries });

      if (result) {
        await page?.close();
        return result;
      }

      if (attempt < maxRetries) {
        await page?.close();
        await waitBeforeRetry(attempt);
      }
    } catch (error: any) {
      lastError = error;
      console.error(`💥 [FEDEX] Attempt ${attempt}/${maxRetries} failed:`, error.message);
      await page?.close();
      if (attempt < maxRetries) {
        await waitBeforeRetry(attempt);
      }
    }
  }

  console.error(`💥 [FEDEX] All ${maxRetries} attempts failed`);
  throw lastError || new Error('Failed to capture screenshot after all retries');
}

export async function fedexTrackingShipment({ codes }: { codes: string }): Promise<{ status: string; buffer: Buffer }> {
  console.log(`📍 [FEDEX] Starting screenshot for tracking: ${codes}`);

  const browserContext = await PuppeteerBrowserSingleton.getInstance();
  if (!browserContext) {
    throw new Error('Failed to get browser context');
  }

  const maxRetries = 5;

  try {
    const { buffer, status } = await retryScreenshotCapture({ browserContext, codes, maxRetries });

    return {
      buffer,
      status: status === 'DELIVERED' ? 'DELIVERED' : 'UNKNOWN'
    };
  } catch (error) {
    console.error(`💥 [FEDEX] Error in fedexTrackingShipment:`, error);
    throw error;
  }
}