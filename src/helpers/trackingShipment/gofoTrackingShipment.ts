import { Page } from "playwright";
import { applyStealthPatches, setStealthHeaders } from "..";
import { PlaywrightBrowserSingleton } from "../browser/PlaywrightBrowserSingleton";

const GOFO_TRACKING_URL = () =>
  `https://www.gofo.com/us/track`;

/** Visit GoFo homepage first to warm up cookies — reduces bot-score significantly */
async function warmUpCookies(page: Page): Promise<void> {
  console.log(`🍪 [GOFO] Warming up cookies via gofo.com...`);
  try {
    await page.goto('https://www.gofo.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000)); // Wait a bit to ensure cookies are set
    await hideUdeskPanel(page);
    await dismissCookieDialog(page);
    console.log(`✅ [GOFO] Cookie warm-up complete`);
  } catch (err: any) {
    console.log(`⚠️ [GOFO] Cookie warm-up failed (non-fatal): ${err.message}`);
  }
}

/** Hide the Udesk live chat widget */
async function hideUdeskPanel(page: Page): Promise<void> {
  try {
    const udeskPanel = await page.$('#udesk_panel');
    if (udeskPanel) {
      await page.evaluate((el) => {
        if (el) {
          (el as any).style.display = 'none';
        }
      }, udeskPanel);
      console.log(`✅ [GOFO] Udesk panel hidden`);
    }
  } catch (err: any) {
    console.log(`⚠️ [GOFO] Failed to hide udesk panel: ${err.message}`);
  }
}

/** Dismiss the GoFo cookie consent dialog */
async function dismissCookieDialog(page: Page): Promise<void> {
  try {
    // Find and click the "ACCEPT COOKIES" button
    const buttons = await page.$$('button[data-slot="base"]');
    for (const btn of buttons) {
      const text = await btn.textContent();
      if (text?.includes('ACCEPT')) {
        console.log(`🍪 [GOFO] Found accept button, clicking...`);
        await btn.click();
        await new Promise(r => setTimeout(r, 500));
        console.log(`✅ [GOFO] Cookie dialog dismissed`);
        return;
      }
    }
    
    // Fallback: hide the dialog if button not found
    const dialog = await page.$('dialog.cookie');
    if (dialog) {
      await page.evaluate((el) => {
        if (el) {
          (el as any).style.display = 'none';
        }
      }, dialog);
      console.log(`✅ [GOFO] Cookie dialog hidden via CSS`);
    }
  } catch (err: any) {
    console.log(`⚠️ [GOFO] Failed to dismiss cookie dialog: ${err.message}`);
  }
}

async function findTrackButton(page: Page): Promise<any> {
  // Try 1: Parent class selector (most specific)
  let button = await page.$('.track-btn button');
  if (button) {
    console.log(`📍 [GOFO] Found button via .track-btn button selector`);
    return button;
  }
  
  // Try 2: Button with data-slot attribute
  button = await page.$('button[data-slot="base"]');
  if (button) {
    console.log(`📍 [GOFO] Found button via data-slot selector`);
    return button;
  }
  
  // Try 3: Any button in tracking div
  button = await page.$('div.track-btn button');
  if (button) {
    console.log(`📍 [GOFO] Found button via track section selector`);
    return button;
  }
  
  // Try 4: Generic button (last resort)
  button = await page.$('button');
  if (button) {
    console.log(`📍 [GOFO] Found button via generic button selector`);
    return button;
  }
  
  return null;
}

async function clickTrackButton(page: Page, button: any): Promise<boolean> {
  try {
    // Ensure button is visible and clickable
    await button.scrollIntoViewIfNeeded();
    await new Promise(r => setTimeout(r, 500));
    
    await button.click();
    console.log(`🔍 [GOFO] Successfully clicked track button`);
    return true;
  } catch (clickErr: any) {
    console.log(`⚠️ [GOFO] Click failed: ${clickErr.message}, trying force click...`);
    try {
      await button.click({ force: true });
      console.log(`🔍 [GOFO] Force clicked track button`);
      return true;
    } catch (forceErr: any) {
      console.log(`⚠️ [GOFO] Force click failed: ${forceErr.message}`);
      return false;
    }
  }
}

async function fillTrackingForm(page: Page, codes: string): Promise<boolean> {
  try {
    // Hide overlays and dismiss dialogs
    await hideUdeskPanel(page);
    await dismissCookieDialog(page);
    
    // Try specific selectors first, then fall back to general ones
    const inputSelector = 'input[placeholder*="Tracking Number"], input[data-slot="base"], input[placeholder*="track"], input[name*="track"], input[id*="track"], input[type="text"]';
    const input = await page.$(inputSelector);
    
    if (!input) {
      console.log(`⚠️ [GOFO] Tracking input not found`);
      return false;
    }

    await page.fill(inputSelector, codes);
    console.log(`✏️ [GOFO] Entered tracking code: ${codes}`);

    // Wait a moment for form to be interactive
    await new Promise(r => setTimeout(r, 2000));

    // Find and click button
    const submitButton = await findTrackButton(page);
    if (submitButton) {
      const clicked = await clickTrackButton(page, submitButton);
      if (clicked) {
        return true;
      }
    }
    
    console.log(`⚠️ [GOFO] Submit button click failed, trying Enter key...`);
    await page.press(inputSelector, 'Enter');
    console.log(`🔍 [GOFO] Pressed Enter key`);
    return true;
  } catch (err: any) {
    console.log(`⚠️ [GOFO] Error filling form: ${err.message}`);
    return false;
  }
}

async function normalizeStatus(statusText: string): Promise<string> {
  const upperStatus = statusText.toUpperCase();
  if (upperStatus.includes('DELIVERED')) {
    return 'DELIVERED';
  }
  if (upperStatus.includes('IN TRANSIT') || upperStatus.includes('OUT FOR DELIVERY')) {
    return 'IN_TRANSIT';
  }
  return upperStatus.length > 0 ? upperStatus : 'UNKNOWN';
}

async function extractTrackingStatus(page: Page): Promise<string> {
  try {
    const statusSelectors = [
      'span.font-medium',           // GoFo main status: <span class="... font-medium Delivered">Delivered</span>
      'span[class*="font-medium"]', // More flexible version
      '.status-text',
      '[data-testid="status"]',
      '.tracking-status',
      '.shipment-status',
      '.event-status',
      'span.status'
    ];

    for (const selector of statusSelectors) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          const statusText = await element.textContent();
          if (statusText && statusText.trim().length > 0) {
            const trimmed = statusText.trim();
            // Only accept reasonable status text lengths
            if (trimmed.length > 0 && trimmed.length < 100) {
              console.log(`📊 [GOFO] Tracking status extracted via "${selector}": ${trimmed}`);
              return await normalizeStatus(trimmed);
            }
          }
        }
      } catch (selectorErr: any) {
        // Continue to next selector if this one fails
        console.log(`⚠️ [GOFO] Selector "${selector}" failed: ${selectorErr.message}`);
      }
    }
    console.log(`⚠️ [GOFO] Could not extract tracking status from page`);
    return 'UNKNOWN';
  } catch (err: any) {
    console.log(`⚠️ [GOFO] Error extracting status: ${err.message}`);
    return 'UNKNOWN';
  }
}

async function attemptGofo(page: Page, codes: string, attempt: number, maxRetries: number): Promise<{ buffer: Buffer; status: string } | null> {
  const url = GOFO_TRACKING_URL();
  console.log(`🌐 [GOFO] Navigating to GoFo tracking (attempt ${attempt}/${maxRetries})...`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log(`✅ [GOFO] Page loaded`);

    await new Promise(r => setTimeout(r, 10000)); // Wait for potential dynamic content to load

    const formFilled = await fillTrackingForm(page, codes);
    if (!formFilled) {
      return null;
    }

    console.log(`⏳ [GOFO] Waiting for tracking results...`);
    await new Promise(resolve => setTimeout(resolve, 10000));

    const status = await extractTrackingStatus(page);
    await new Promise(r => setTimeout(r, 2000));

    const screenshot = await page.screenshot({ fullPage: true, clip: { x: 0, y: 670, width: 1280, height: 900 } });
    console.log(`📸 [GOFO] Screenshot taken, size: ${screenshot.length} bytes`);

    return { buffer: Buffer.from(screenshot), status };
  } catch (err: any) {
    console.log(`⚠️ [GOFO] Attempt error: ${err.message}`);
    return null;
  }
}

async function runAttempt(codes: string, attempt: number, maxRetries: number): Promise<{ buffer: Buffer; status: string } | null> {
  const context = await PlaywrightBrowserSingleton.getContextWithoutProxy();
  if (!context) throw new Error('Failed to get Playwright context');

  const page = await context.newPage();
  if (!page) throw new Error('Failed to create Playwright page');

  try {
    await applyStealthPatches(page);
    await setStealthHeaders(page);
    await warmUpCookies(page);

    return await attemptGofo(page, codes, attempt, maxRetries);
  } finally {
    await page.close();
  }
}

async function retryAttempts(codes: string, maxRetries: number): Promise<{ buffer: Buffer; status: string }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`\n🔄 [GOFO] Attempt ${attempt}/${maxRetries}`);
      const result = await runAttempt(codes, attempt, maxRetries);
      
      if (result) {
        console.log(`✅ [GOFO] Success on attempt ${attempt}`);
        return result;
      }

      if (attempt < maxRetries) {
        const delay = attempt * 2000;
        console.log(`⏳ [GOFO] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error: any) {
      lastError = error;
      console.error(`❌ [GOFO] Attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxRetries) {
        const delay = attempt * 2000;
        console.log(`⏳ [GOFO] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All attempts failed
  if (lastError) {
    throw lastError;
  }
  throw new Error('All GoFo tracking attempts failed');
}

export const gofoTrackingShipment = async ({ codes }: { codes: string }) => {
  console.log(`📍 [GOFO] Starting screenshot for tracking code: ${codes}`);

  const maxRetries = 3;

  try {
    const result = await retryAttempts(codes, maxRetries);
    console.log(`✨ [GOFO] Completed! Status: ${result.status}`);
    return result;
  } catch (error: any) {
    console.error(`💥 [GOFO] Error in gofoTrackingShipment: ${error.message}`);
    throw error;
  }
};
