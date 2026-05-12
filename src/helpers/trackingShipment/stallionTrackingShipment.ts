import { Page } from "playwright";
import { applyStealthPatches, setStealthHeaders } from "..";
import { PlaywrightBrowserSingleton } from "../browser/PlaywrightBrowserSingleton";

const STALLION_TRACKING_URL = `https://stallion.ca/track/`;

async function fillTrackingForm(page: Page, codes: string): Promise<boolean> {
  try {
    const inputSelector = 'input[data-vv-name="tracking_number"]';
    await page.waitForSelector(inputSelector, { timeout: 15000 });
    await page.fill(inputSelector, codes);
    console.log(`✏️ [STALLION] Entered tracking code: ${codes}`);

    await new Promise(r => setTimeout(r, 500));

    // Try track button selectors in order of specificity
    const button = await page.$('.form-group button') ?? await page.$('button.track_2');
    if (!button) {
      console.log(`⚠️ [STALLION] Track button not found, trying Enter key...`);
      await page.press(inputSelector, 'Enter');
      return true;
    }

    await button.scrollIntoViewIfNeeded();
    await button.click();
    console.log(`🔍 [STALLION] Clicked track button`);
    return true;
  } catch (err: any) {
    console.log(`⚠️ [STALLION] Error filling form: ${err.message}`);
    return false;
  }
}

async function normalizeStatus(statusText: string): Promise<string> {
  const upper = statusText.toUpperCase();
  if (upper.includes('DELIVERED')) return 'DELIVERED';
  return upper.length > 0 ? upper : 'UNKNOWN';
}

async function extractTrackingStatus(page: Page): Promise<string> {
  try {
    // Primary: first list-group-item h5 (most recent event status)
    const statusEl = await page.$('.list-group-item h5');
    if (statusEl) {
      const text = await statusEl.textContent();
      if (text?.trim()) {
        console.log(`📊 [STALLION] Status extracted: ${text.trim()}`);
        return await normalizeStatus(text.trim());
      }
    }

    // Fallback selectors
    const fallbacks = [
      '.list-group-item-action h5',
      '.tracking-status',
      '[data-testid="status"]',
    ];
    for (const sel of fallbacks) {
      const el = await page.$(sel);
      if (el) {
        const text = await el.textContent();
        if (text?.trim()) {
          console.log(`📊 [STALLION] Status extracted via "${sel}": ${text.trim()}`);
          return await normalizeStatus(text.trim());
        }
      }
    }

    console.log(`⚠️ [STALLION] Could not extract tracking status`);
    return 'UNKNOWN';
  } catch (err: any) {
    console.log(`⚠️ [STALLION] Error extracting status: ${err.message}`);
    return 'UNKNOWN';
  }
}

async function attemptStallion(
  page: Page,
  codes: string,
  attempt: number,
  maxRetries: number
): Promise<{ buffer: Buffer; status: string } | null> {
  console.log(`🌐 [STALLION] Navigating to tracking page (attempt ${attempt}/${maxRetries})...`);

  try {
    await page.goto(STALLION_TRACKING_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log(`✅ [STALLION] Page loaded`);

    await new Promise(r => setTimeout(r, 3000));

    const formFilled = await fillTrackingForm(page, codes);
    if (!formFilled) return null;

    console.log(`⏳ [STALLION] Waiting for tracking results...`);
    try {
      await page.waitForSelector('.list-group-item', { timeout: 15000 });
    } catch {
      console.log(`⚠️ [STALLION] Timed out waiting for results, capturing whatever is on screen`);
    }

    await new Promise(r => setTimeout(r, 2000));

    const status = await extractTrackingStatus(page);

    const screenshot = await page.screenshot({ fullPage: false, clip: { x: 0, y: 200, width: 1280, height: 800 } });
    console.log(`📸 [STALLION] Screenshot taken, size: ${screenshot.length} bytes`);

    return { buffer: Buffer.from(screenshot), status };
  } catch (err: any) {
    console.log(`⚠️ [STALLION] Attempt error: ${err.message}`);
    return null;
  }
}

async function runAttempt(
  codes: string,
  attempt: number,
  maxRetries: number
): Promise<{ buffer: Buffer; status: string } | null> {
  const context = await PlaywrightBrowserSingleton.getContextWithoutProxy();
  if (!context) throw new Error('Failed to get Playwright context');

  const page = await context.newPage();
  if (!page) throw new Error('Failed to create Playwright page');

  try {
    await applyStealthPatches(page);
    await setStealthHeaders(page);
    return await attemptStallion(page, codes, attempt, maxRetries);
  } finally {
    await page.close();
  }
}

async function retryAttempts(
  codes: string,
  maxRetries: number
): Promise<{ buffer: Buffer; status: string }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`\n🔄 [STALLION] Attempt ${attempt}/${maxRetries}`);
      const result = await runAttempt(codes, attempt, maxRetries);

      if (result) {
        console.log(`✅ [STALLION] Success on attempt ${attempt}`);
        return result;
      }

      if (attempt < maxRetries) {
        const delay = attempt * 2000;
        console.log(`⏳ [STALLION] Waiting ${delay}ms before retry...`);
        await new Promise(r => setTimeout(r, delay));
      }
    } catch (error: any) {
      lastError = error;
      console.error(`❌ [STALLION] Attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxRetries) {
        const delay = attempt * 2000;
        console.log(`⏳ [STALLION] Waiting ${delay}ms before retry...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  if (lastError) throw lastError;
  throw new Error('All Stallion tracking attempts failed');
}

export const stallionTrackingShipment = async ({ codes }: { codes: string }) => {
  console.log(`📍 [STALLION] Starting tracking for code: ${codes}`);

  const maxRetries = 3;

  try {
    const result = await retryAttempts(codes, maxRetries);
    console.log(`✨ [STALLION] Completed! Status: ${result.status}`);
    return result;
  } catch (error: any) {
    console.error(`💥 [STALLION] Error in stallionTrackingShipment: ${error.message}`);
    throw error;
  }
};
