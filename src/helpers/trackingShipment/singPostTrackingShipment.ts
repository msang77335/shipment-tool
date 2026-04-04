import { Page } from "playwright";
import { applyStealthPatches, setStealthHeaders } from "..";
import { PlaywrightBrowserSingleton } from "../browser/PlaywrightBrowserSingleton";

const SINGPOST_TRACKING_URL = () =>
  `https://www.singpost.com/track-items`;

/** Visit SingPost homepage first to warm up cookies — reduces bot-score significantly */
async function warmUpCookies(page: Page): Promise<void> {
  console.log(`🍪 [SING POST] Warming up cookies via singpost.com...`);
  try {
    await page.goto('https://www.singpost.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000 + Math.floor(Math.random() * 1500)));
    console.log(`✅ [SING POST] Cookie warm-up complete`);
  } catch (err: any) {
    console.log(`⚠️ [SING POST] Cookie warm-up failed (non-fatal): ${err.message}`);
  }
}

async function attemptSingPost(page: Page, codes: string, attempt: number, maxRetries: number): Promise<{ buffer: Buffer; status: string } | null> {
  const url = SINGPOST_TRACKING_URL();
  console.log(`🌐 [SING POST] Navigating to SingPost tracking (attempt ${attempt}/${maxRetries})...`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Fill in tracking numbers
  await page.fill('#tracking-numbers-node', codes);
  console.log(`✏️ [SING POST] Entered tracking codes: ${codes}`);

  // Click search button
  await page.click('#edit-submit');
  console.log(`🔍 [SING POST] Clicked search button`);

  // Wait for potential reCAPTCHA to appear and solve it
  await new Promise(r => setTimeout(r, 10000));

  // Check if reCAPTCHA modal is displayed
  const recaptchaModal = await page.$('#recaptcha-modal-tnt');
  if (recaptchaModal) {
    const isDisplayed = await recaptchaModal.evaluate((el: any) => {
      const style = (globalThis as any).getComputedStyle(el);
      return style.display !== 'none';
    });

    if (!isDisplayed) {
      console.log(`⚠️ [SING POST] reCAPTCHA modal not displayed, retrying...`);
      return null;
    }
  }

  console.log(`🔍 [SING POST] Attempting to solve reCAPTCHAs...`);
  const result = await page.solveRecaptchas();
  console.log(`✅ [SING POST] reCAPTCHA result:`, {
    captchasFound: result.captchas?.length || 0,
    solutionsCount: result.solutions?.length || 0,
    solvedCount: result.solved?.length || 0,
    hasError: !!result.error
  });

  if (result.error) {
    console.log(`⚠️ [SING POST] reCAPTCHA solving error:`, result.error);
  }

  console.log(`⏳ [SING POST] Waiting 15 seconds for content to load...`);
  await new Promise(resolve => setTimeout(resolve, 15000));

  // Wait for status information to load
  let status = "UNKNOWN";
  try {
    const statusElement = await page.$('#delivered_status');
    if (statusElement) {
      const statusText = await statusElement.textContent();
      // Extract status from text like "Product Delivered (Country code: GB)"
      const match = new RegExp(/Product\s+(\w+)/).exec(statusText || '');
      status = match ? match[1] : "UNKNOWN";
      console.log(`📊 [SING POST] Status: ${status}`);
    } else {
      console.log(`⚠️ [SING POST] Status element not found`);
    }
  } catch (err: any) {
    console.log(`⚠️ [SING POST] Error extracting status: ${err.message}`);
  }

  await new Promise(r => setTimeout(r, 2000));

  const screenshot = await page.screenshot({ fullPage: false });
  console.log(`📸 [SING POST] Screenshot taken, size: ${screenshot.length} bytes`);

  return { buffer: Buffer.from(screenshot), status: status?.toUpperCase() || 'UNKNOWN' };
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

    return await attemptSingPost(page, codes, attempt, maxRetries);
  } finally {
    await page.close();
  }
}

export const singPostTrackingShipment = async ({ codes }: { codes: string }) => {
  const maxRetries = 5;
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await runAttempt(codes, attempt, maxRetries);
      if (result) {
        console.log(`✅ [SING POST] Success on attempt ${attempt}`);
        return result;
      }
    } catch (err: any) {
      lastError = err;
      console.error(`💥 [SING POST] Attempt ${attempt} error: ${err.message}`);
    }

    if (attempt < maxRetries) {
      const delay = attempt * 5000;
      console.log(`⏳ [SING POST] Waiting ${delay}ms before retry...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return {
    status: 'UNKNOWN',
    buffer: Buffer.from('') // Placeholder, you can replace with actual image buffer if needed
  }
}