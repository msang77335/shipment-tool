import { Browser, Page } from "puppeteer";
import { waitBeforeRetry } from "..";
import { PuppeteerBrowserSingleton } from "../browser/PuppeteerBrowserSingleton";

async function hideCrAnchor(page: Page): Promise<void> {
  try {
    // Fallback: hide the dialog if button not found
    const dialog = await page.$('.grecaptcha-badge');
    if (dialog) {
      await page.evaluate((el) => {
        if (el) {
          (el as any).style.display = 'none';
        }
      }, dialog);
      console.log(`✅ [UPS] Cookie dialog hidden via CSS`);
    }
  } catch (err: any) {
    console.log(`⚠️ [UPS] Failed to hide cookie dialog: ${err.message}`);
  }
}

/** Hide the UPS cookie consent dialog */
async function hideCookieDialog(page: Page): Promise<void> {
  try {
    // Fallback: hide the dialog if button not found
    const dialog = await page.$('.ot-sdk-row');
    if (dialog) {
      await page.evaluate((el) => {
        if (el) {
          (el as any).style.display = 'none';
        }
      }, dialog);
      console.log(`✅ [UPS] Cookie dialog hidden via CSS`);
    }
  } catch (err: any) {
    console.log(`⚠️ [UPS] Failed to hide cookie dialog: ${err.message}`);
  }
}

/** Hide the Assistant live chat widget */
async function hideAssistantPanel(page: Page): Promise<void> {
  try {
    const assistantPanel = await page.$('#WACWidget');
    if (assistantPanel) {
      await page.evaluate((el) => {
        if (el) {
          (el as any).style.display = 'none';
        }
      }, assistantPanel);
      console.log(`✅ [UPS] Assistant panel hidden`);
    }
  } catch (err: any) {
    console.log(`⚠️ [UPS] Failed to hide assistant panel: ${err.message}`);
  }
}

async function navigateAndTracking(page: Page, trackingURL: string, codes: string, attempt: number, maxRetries: number) {
  console.log(`🌐 [UPS] Navigating to ups.com (attempt ${attempt}/${maxRetries})...`);
  await page.goto(trackingURL, {
    waitUntil: 'domcontentloaded'
  });

  console.log(`⏳ [UPS] Waiting 5 seconds for content to load...`);
  await new Promise(resolve => setTimeout(resolve, 5000));

  const btnAcceptCookie = await page.$('#onetrust-accept-btn-handler');
  if (btnAcceptCookie) {
    await page.click('#onetrust-accept-btn-handler');
    console.log(`✅ [UPS] Accepted cookie consent`);
  }

  console.log(`⌨️ [UPS] Entering tracking code...`);
  await page.$eval('#tracking-numbers', (el, value) => {
    (el).value = value;
  }, codes);

  console.log(`⌨️ [UPS] Clicking Track button...`);
  await page.click('.submit-button');

  console.log(`⏳ [UPS] Waiting 10 seconds for content to load...`);
  await new Promise(resolve => setTimeout(resolve, 10000));
}

async function checkTrackingData(page: Page): Promise<boolean> {
  console.log(`🔍 [UPS] Checking for tracking data...`);
  const pageContent = await page.$('.ups-card_content');

  if (pageContent) {
    await hideAssistantPanel(page);
    await hideCookieDialog(page);
    await hideCrAnchor(page);
  }

  return !!pageContent;
}


async function getShipmentStatus(page: Page): Promise<string> {
  console.log(`🔍 [UPS] Extracting shipment status...`);
  return await page.evaluate(() => {
    const statusElement = (globalThis as any).document.querySelector('#st_App_DelvdLabel');
    const statusText = statusElement?.textContent?.trim() || '';

    if (statusText.toLowerCase().includes('delivered')) {
      return 'DELIVERED';
    }

    return 'UNKNOWN';
  });
}

async function attemptScreenshot({ page, codes, attempt, maxRetries }: { page: Page; codes: string; attempt: number; maxRetries: number; }): Promise<{ buffer: Buffer; status: string } | null> {
  const trackingURL = `https://www.ups.com/us/en/home`;
  await navigateAndTracking(page, trackingURL, codes, attempt, maxRetries);

  const hasTrackingData = await checkTrackingData(page);

  if (hasTrackingData) {
    const status = await getShipmentStatus(page);

    console.log(`✅ [UPS] Tracking data found: ${status}`);

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
      console.log(`🆕 [UPS] Creating new page (attempt ${attempt}/${maxRetries})...`);
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
      console.error(`💥 [UPS] Attempt ${attempt}/${maxRetries} failed:`, error.message);
      await page?.close();
      if (attempt < maxRetries) {
        await waitBeforeRetry(attempt);
      }
    }
  }

  console.error(`💥 [UPS] All ${maxRetries} attempts failed`);
  throw lastError || new Error('Failed to capture screenshot after all retries');
}

export async function upsTrackingShipment({ codes }: { codes: string }): Promise<{ status: string; buffer: Buffer }> {
  console.log(`📍 [UPS] Starting screenshot for tracking: ${codes}`);

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
    console.error(`💥 [UPS] Error in upsTrackingShipment:`, error);
    throw error;
  }
}