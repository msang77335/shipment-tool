import { Page } from 'playwright';
import { applyStealthPatches, ScreenshotQuery, setStealthHeaders } from '..';
import { PlaywrightBrowserSingleton } from '../browser/PlaywrightBrowserSingleton';

/**
 * 4PX tracking function - navigates from homepage, fills form, extracts status
 * Supports tracking parcels by entering tracking number on 4PX.com
 */
export async function fourPXTrackingShipment({ codes }: Pick<ScreenshotQuery, 'codes'>): Promise<{ status: string; buffer: Buffer }> {
  console.log(`🚀 [4PX] Starting 4PX tracking for code: ${codes}`);

  const maxRetries = 3;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await attemptFourPX(codes, attempt, maxRetries);
      if (result) {
        console.log(`✅ [4PX] Success on attempt ${attempt}`);
        return result;
      }
    } catch (err: any) {
      lastError = err;
      console.error(`💥 [4PX] Attempt ${attempt} error: ${err.message}`);
    }

    if (attempt < maxRetries) {
      const delay = attempt * 5000;
      console.log(`⏳ [4PX] Waiting ${delay}ms before retry...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  console.error(`💥 [4PX] All ${maxRetries} attempts failed`);
  throw lastError || new Error('Failed to capture 4PX tracking screenshot after all retries');
}

async function attemptFourPX(codes: string, attempt: number, maxRetries: number): Promise<{ status: string; buffer: Buffer } | null> {
  const context = await PlaywrightBrowserSingleton.getContextWithoutProxy();
  if (!context) {
    throw new Error('Failed to get browser context for 4PX tracking');
  }

  const page = await context.newPage();
  if (!page) {
    throw new Error('Failed to create Playwright page');
  }

  try {
    console.log(`📄 [4PX] Attempt ${attempt}/${maxRetries} - Creating new page...`);

    await applyStealthPatches(page);
    await setStealthHeaders(page);

    // Navigate to 4PX homepage
    console.log(`🌐 [4PX] Navigating to 4PX.com homepage...`);
    await page.goto(`https://track.4px.com/#/result/0/${codes}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    console.log(`✅ [4PX] Homepage loaded`);

    // Wait for main content to load
    console.log(`⏳ [4PX] Waiting for main content to load...`);
    await new Promise(r => setTimeout(r, 10000)); // Wait for any dynamic content

    // Display the package status guide element
    console.log(`📋 [4PX] Displaying package status guide...`);
    await page.evaluate(() => {
      const guideElement = (globalThis as any).document.getElementById('first-step');
      if (guideElement) {
        guideElement.style.display = 'none';
      }
    });
    await new Promise(r => setTimeout(r, 2000)); // Wait for element to render

    try {
      // Extract tracking status
      console.log(`📊 [4PX] Extracting tracking status...`);
      const status = await extract4PXStatus(page);
      console.log(`✅ [4PX] Status extracted: ${status}`);

      // Take screenshot
      console.log(`📸 [4PX] Taking screenshot...`);
      const screenshot = await page.screenshot({ fullPage: false });
      console.log(`✅ [4PX] Screenshot captured, size: ${screenshot.length} bytes`);

      return {
        status,
        buffer: Buffer.from(screenshot)
      };
    } catch (error: any) {
      console.error(`⚠️ [4PX] Attempt ${attempt} failed: ${error.message}`);
      return null; // Return null to trigger retry
    } finally {
      if (page && !page.isClosed()) {
        await page.close().catch(e => console.log('Error closing page:', e));
      }
    }
  } catch (error: any) {
    console.error(`💥 [4PX] Unexpected error in attempt ${attempt}: ${error.message}`);
    throw error; // Throw to trigger retry
  }
}

/**
 * Extract 4PX tracking status from results page
 * Returns only 2 statuses: 'DELIVERED' or 'UNKNOWN'
 */
async function extract4PXStatus(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const doc = (globalThis as any).document;

    // Try Method 1: Card status element with icon class
    const cardStatus = doc.querySelector('.cardStatus');
    if (cardStatus) {
      const statusTextSpan = cardStatus.querySelector('.text');
      const statusText = statusTextSpan?.textContent?.trim().toLowerCase() || '';
      console.log(`[4PX STATUS] Method 1 - Card status: "${statusText}"`);

      if (statusText.includes('successful delivery') || statusText.includes('delivered') || statusText.includes('giao')) {
        return 'DELIVERED';
      }
    }

    console.log(`[4PX STATUS] No delivered status found, returning UNKNOWN`);
    return 'UNKNOWN';
  });
}
