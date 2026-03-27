import { Page } from 'playwright';
import { applyStealthPatches, ScreenshotQuery, setStealthHeaders } from '..';
import { PlaywrightBrowserSingleton } from '../PlaywrightBrowserSingleton';

/**
 * Evri tracking function - navigates from homepage, fills form, extracts status
 * Supports tracking UK parcels by entering tracking number on Evri.com
 */
export async function evriTrackingShipment({ codes }: Pick<ScreenshotQuery, 'codes'>): Promise<{ status: string; buffer: Buffer }> {
  console.log(`🚀 [EVRI] Starting Evri tracking for code: ${codes}`);

  const maxRetries = 5;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await attemptEvri(codes, attempt, maxRetries);
      if (result) {
        console.log(`✅ [EVRI] Success on attempt ${attempt}`);
        return result;
      }
    } catch (err: any) {
      lastError = err;
      console.error(`💥 [EVRI] Attempt ${attempt} error: ${err.message}`);
    }

    if (attempt < maxRetries) {
      const delay = attempt * 5000;
      console.log(`⏳ [EVRI] Waiting ${delay}ms before retry...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  console.error(`💥 [EVRI] All ${maxRetries} attempts failed`);
  throw lastError || new Error('Failed to capture Evri tracking screenshot after all retries');
}

async function attemptEvri(codes: string, attempt: number, maxRetries: number): Promise<{ status: string; buffer: Buffer } | null> {
  const context = await PlaywrightBrowserSingleton.getContextWithoutProxy();
  if (!context) {
    throw new Error('Failed to get browser context for Evri tracking');
  }

  const page = await context.newPage();
  if (!page) {
    throw new Error('Failed to create Playwright page');
  }

  try {
    console.log(`📄 [EVRI] Attempt ${attempt}/${maxRetries} - Creating new page...`);

    await applyStealthPatches(page);
    await setStealthHeaders(page);

    // Navigate to Evri homepage
    console.log(`🌐 [EVRI] Navigating to Evri.com homepage...`);
    await page.goto('https://www.evri.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    console.log(`✅ [EVRI] Homepage loaded`);

    // Wait for main content to load
    console.log(`⏳ [EVRI] Waiting for main content to load...`);
    await new Promise(r => setTimeout(r, 10000)); // Wait for any dynamic content

    // Handle cookie consent modal if present
    console.log(`🍪 [EVRI] Checking for cookie consent modal...`);
    try {
      // Disable animations to prevent page jumping
      await page.evaluate(() => {
        const style = (globalThis as any).document.createElement('style');
        style.textContent = '* { animation: none !important; transition: none !important; }';
        (globalThis as any).document.head.appendChild(style);
      });

      // Click the OneTrust cookie consent button directly
      const cookieClicked = await page.evaluate(() => {
        const cookieButton = (globalThis as any).document.getElementById('onetrust-accept-btn-handler');
        if (cookieButton) {
          cookieButton.click();
          return true;
        }
        return false;
      });

      if (cookieClicked) {
        console.log(`✅ [EVRI] Cookie button clicked`);
        await new Promise(r => setTimeout(r, 1000)); // Wait for modal to close
      } else {
        console.log(`⚠️ [EVRI] Cookie button not found`);
      }
    } catch (cookieError: any) {
      console.log(`⚠️ [EVRI] Cookie handling error: ${cookieError.message}`);
    }

    // Click on the Track tab to ensure tracking form is visible
    console.log(`🏷️ [EVRI] Waiting for Track tab...`);
    const trackTabSelector = 'button[data-gtm-track="select-Track tab"]';
    await page.waitForSelector(trackTabSelector, { timeout: 10000 });
    console.log(`✅ [EVRI] Track tab found, clicking...`);
    await page.click(trackTabSelector);
    console.log(`✅ [EVRI] Track tab clicked`);

    // Wait for tab content to transition
    await new Promise(r => setTimeout(r, 800));

    // Wait for tracking input field to be visible
    console.log(`⏳ [EVRI] Waiting for tracking input field...`);
    const trackingInputSelector = '#tracking-number';
    await page.waitForSelector(trackingInputSelector, { timeout: 15000 });
    console.log(`✅ [EVRI] Tracking input field found`);

    // Wait a bit for any animations
    await new Promise(r => setTimeout(r, 1000));

    // Enter tracking code
    console.log(`🔤 [EVRI] Entering tracking code: ${codes}`);
    await page.fill(trackingInputSelector, codes);
    console.log(`✅ [EVRI] Tracking code entered`);

    // Wait for input to be filled (may trigger validation)
    await new Promise(r => setTimeout(r, 800));

    // Find and click the Track button
    console.log(`🔍 [EVRI] Looking for Track button...`);
    const trackButtonSelector = 'button[data-test-id="track-entry-submit"]';
    await page.waitForSelector(trackButtonSelector, { timeout: 10000, state: 'visible' });
    console.log(`✅ [EVRI] Track button found, clicking...`);
    await page.click(trackButtonSelector);
    console.log(`✅ [EVRI] Track button clicked`);

    // Wait for results page to load
    console.log(`⏳ [EVRI] Waiting for tracking results to load...`);
    try {
      // Wait for status element to appear instead of waiting for navigation
      await page.waitForSelector('h3[data-test-id="details-ticket-primary-status-text"], p[data-test-id="details-ticket-primary-point"]', { 
        timeout: 45000 
      });
      console.log(`✅ [EVRI] Tracking results loaded`);
    } catch (navError: any) {
      console.log(`⚠️ [EVRI] Tracking results wait timed out (non-fatal): ${navError.message}`);
      return null; // Return null to trigger retry
    }

    // Wait a bit more for dynamic content to render
    await new Promise(r => setTimeout(r, 3000));

    // Extract tracking status
    console.log(`📊 [EVRI] Extracting tracking status...`);
    const status = await extractEvriStatus(page);
    console.log(`✅ [EVRI] Status extracted: ${status}`);

    // Take screenshot
    console.log(`📸 [EVRI] Taking screenshot...`);
    const screenshot = await page.screenshot({ fullPage: false });
    console.log(`✅ [EVRI] Screenshot captured, size: ${screenshot.length} bytes`);

    return {
      status,
      buffer: Buffer.from(screenshot)
    };
  } catch (error: any) {
    console.error(`⚠️ [EVRI] Attempt ${attempt} failed: ${error.message}`);
    return null; // Return null to trigger retry
  } finally {
    if (page && !page.isClosed()) {
      await page.close().catch(e => console.log('Error closing page:', e));
    }
  }
}

/**
 * Extract Evri tracking status from results page
 */
async function extractEvriStatus(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const doc = (globalThis as any).document;

    // Try Method 1: Main status heading with data-test-id
    const statusElement = doc.querySelector('h3[data-test-id="details-ticket-primary-status-text"]');
    const statusText = statusElement?.textContent?.trim() || '';
    if (statusText) {
      console.log(`[EVRI STATUS] Method 1 - h3 heading: "${statusText}"`);
      if (statusText.includes('Delivered') || statusText.includes('delivered')) {
        return 'DELIVERED';
      }
    }

    // Try Method 2: Progress bar at 100%
    const progressBar = doc.querySelector('div[data-test-id="delivery-progress-bar-progress"]');
    if (progressBar) {
      const progressWidth = progressBar?.style?.width || '0%';
      console.log(`[EVRI STATUS] Method 2 - Progress bar width: ${progressWidth}`);
      if (progressWidth === '100%') {
        return 'DELIVERED';
      }
    }

    // Try Method 3: Delivery point message
    const deliveryPoint = doc.querySelector('p[data-test-id="details-ticket-primary-point"] small');
    if (deliveryPoint) {
      const deliveryPointText = deliveryPoint?.textContent?.toLowerCase() || '';
      console.log(`[EVRI STATUS] Method 3 - Delivery point: "${deliveryPointText}"`);
      if (deliveryPointText.includes('delivered') || deliveryPointText.includes('giao')) {
        return 'DELIVERED';
      }
    }

    // Try Method 4: Generic status text search in details section
    const detailsSection = doc.querySelector('[data-test-id="details-ticket-primary"]');
    if (detailsSection) {
      const allText = detailsSection?.textContent?.toLowerCase() || '';
      console.log(`[EVRI STATUS] Method 4 - Details section text includes delivered check`);
      if (allText.includes('delivered') || allText.includes('giao hàng thành công') || allText.includes('đã giao')) {
        return 'DELIVERED';
      }
    }

    console.log(`[EVRI STATUS] No delivered status found, returning UNKNOWN`);
    return 'UNKNOWN';
  });
}
