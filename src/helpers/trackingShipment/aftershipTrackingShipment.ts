import { Page } from 'playwright';
import { isJTExpress, isUSPS, ScreenshotQuery } from "..";
import { PlaywrightBrowserSingleton } from "../PlaywrightBrowserSingleton";

const getTrackingURL = (codes: string, provider: string) => {
  if (isJTExpress(provider)) {
    return `https://www.aftership.com/track?c=jtexpress-vn&t=${codes}`;
  } else if (isUSPS(provider)) {
    return `https://www.aftership.com/track?c=usps-vn&t=${codes}`;
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

async function navigateAndSolveRecaptcha(page: Page, trackingURL: string, attempt: number, maxRetries: number) {
  console.log(`🌐 [AFTERSHIP] Navigating to aftership.com (attempt ${attempt}/${maxRetries})...`);
  await page.goto(trackingURL, {
    waitUntil: 'networkidle'
  });
  console.log(`✅ [AFTERSHIP] Page loaded successfully`);

  console.log(`🔍 [AFTERSHIP] Attempting to solve reCAPTCHAs...`);
  const result = await page.solveRecaptchas();
  console.log(`✅ [AFTERSHIP] reCAPTCHA result:`, {
    captchasFound: result.captchas?.length || 0,
    solutionsCount: result.solutions?.length || 0,
    solvedCount: result.solved?.length || 0,
    hasError: !!result.error
  });

  if (result.error) {
    console.log(`⚠️ [AFTERSHIP] reCAPTCHA solving error:`, result.error);
  }

  console.log(`⏳ [AFTERSHIP] Waiting 15 seconds for content to load...`);
  await new Promise(resolve => setTimeout(resolve, 15000));
}

async function checkTrackingData(page: Page): Promise<boolean> {
  console.log(`🔍 [AFTERSHIP] Checking for tracking data...`);
  return await page.evaluate(() => {
    const trackingElement = (globalThis as any).document.querySelector('#tracking');
    if (!trackingElement?.shadowRoot) {
      return false;
    }

    // Get all shipment items from inside the shadow DOM
    const shipmentElements = trackingElement.shadowRoot.querySelectorAll('.multiShipmentResultItem');

    const trackingNumbers = []
    shipmentElements.forEach((element: any) => {
      // Extract tracking number from the span with class 'whitespace-nowrap overflow-hidden'
      const trackingSpan = element.querySelector('.whitespace-nowrap.overflow-hidden');
      const trackingNumber = trackingSpan ? trackingSpan.textContent.trim() : null;

      if (trackingNumber) {
        trackingNumbers.push(trackingNumber);
      }
    });

    if (trackingNumbers.length === 0) {
      return false;
    }

    let isSomeLoading = false;
    shipmentElements.forEach((element: any) => {
      // Get the HTML content of the entire item
      const html = element.innerHTML;

      const isLoading = /Checking for updates/i.test(html);

      if (isLoading) {
        isSomeLoading = true;
      }
    });

    if (isSomeLoading) {
      return false;
    }

    return true
  });
}

async function getAllShipments(page: Page): Promise<{ status: string }> {
  const shipments = await page.evaluate(() => {
    try {
      // Access the shadow DOM
      const trackingElement = (globalThis as any).document.querySelector('#tracking');
      if (!trackingElement?.shadowRoot) {
        return { shipments: [], totalCount: 0 };
      }

      // Get all shipment items from inside the shadow DOM
      const shipmentElements = trackingElement.shadowRoot.querySelectorAll('.multiShipmentResultItem');

      interface ShipmentResult {
        trackingNumber: string;
        status: 'delivered' | 'unknown';
      }

      const results: ShipmentResult[] = [];

      shipmentElements.forEach((element: any) => {
        // Extract tracking number from the span with class 'whitespace-nowrap overflow-hidden'
        const trackingSpan = element.querySelector('.whitespace-nowrap.overflow-hidden');
        const trackingNumber = trackingSpan ? trackingSpan.textContent.trim() : null;

        // Get the HTML content of the entire item
        const html = element.innerHTML;

        // Check if "Delivered on" exists in this shipment
        const isDelivered = /Delivered\s+on/i.test(html);

        if (trackingNumber) {
          results.push({
            trackingNumber,
            status: isDelivered ? 'delivered' : 'unknown'
          });
        }
      });

      return {
        shipments: results,
        totalCount: results.length
      };
    } catch (error) {
      console.log('📍 [GET ALL SHIPMENTS] Error:', error);
      return { shipments: [], totalCount: 0 };
    }
  });

  // Remove duplicates based on tracking number
  const seen = new Set<string>();
  const uniqueShipments = shipments.shipments.filter((s: any) => {
    if (seen.has(s.trackingNumber)) return false;
    seen.add(s.trackingNumber);
    return true;
  });

  // Convert to uppercase and join with commas
  const status = uniqueShipments
    .map((s: any) => s.status.toUpperCase())
    .join(',');

  const count = uniqueShipments.length;

  console.log(`📦 [SHIPMENTS] Total: ${shipments.totalCount}, Unique: ${count}, Status List: ${status}`);

  return { status };
}

async function captureScreenshot(page: Page): Promise<Buffer> {
  console.log(`✅ [AFTERSHIP] Tracking data found, taking screenshot...`);
  const screenshot = await page.screenshot({ fullPage: false });
  console.log(`✅ [AFTERSHIP] Screenshot captured, size: ${screenshot.length} bytes`);
  console.log(`✨ [AFTERSHIP] All done!`);
  return Buffer.from(screenshot);
}

async function attemptScreenshot({ page, codes, provider, attempt, maxRetries }: { page: Page; codes: string; provider: string; attempt: number; maxRetries: number; }): Promise<{ buffer: Buffer; status: string } | null> {
  const trackingURL = getTrackingURL(codes, provider);
  await navigateAndSolveRecaptcha(page, trackingURL, attempt, maxRetries);

  const hasTrackingData = await checkTrackingData(page);

  if (hasTrackingData) {
    const { status } = await getAllShipments(page);

    console.log(`✅ [AFTERSHIP] Tracking data found: ${status}`);

    const buffer = await captureScreenshot(page);
    return { buffer, status };
  }

  return null;
}

async function createPage(browserContext: any): Promise<Page> {
  const page = await browserContext.newPage();
  page.setDefaultTimeout(120000);
  console.log(`⏱️ [AFTERSHIP] Default timeout set to 120 seconds`);
  return page;
}

async function closePage(page: Page | undefined): Promise<void> {
  if (page && !page.isClosed()) {
    console.log(`🔄 [AFTERSHIP] Closing page...`);
    await page.close().catch((e: any) => console.log('Error closing page:', e));
  }
}

async function waitBeforeRetry(attempt: number): Promise<void> {
  const delay = attempt * 3000;
  console.log(`⏳ [AFTERSHIP] Waiting ${delay}ms before retry...`);
  await new Promise(resolve => setTimeout(resolve, delay));
}

async function captureLastAttemptScreenshot(page: Page): Promise<{ buffer: Buffer; status: string }> {
  const errorScreenshot = await page.screenshot({ fullPage: false });
  console.error(`💥 [AFTERSHIP] Final attempt failed, capturing error screenshot...`);
  await closePage(page);
  return { buffer: Buffer.from(errorScreenshot), status: 'UNKNOWN' };
}

async function retryScreenshotCapture({ browserContext, codes, provider, maxRetries }: { browserContext: any; codes: string; provider: string; maxRetries: number; }): Promise<{ buffer: Buffer; status: string }> {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let page: Page | undefined;
    try {
      console.log(`🆕 [AFTERSHIP] Creating new page (attempt ${attempt}/${maxRetries})...`);
      page = await createPage(browserContext);

      const result = await attemptScreenshot({ page, codes, provider, attempt, maxRetries });

      if (result) {
        await closePage(page);
        return result;
      }

      if (attempt < maxRetries) {
        await closePage(page);
        await waitBeforeRetry(attempt);
      } else {
        return await captureLastAttemptScreenshot(page);
      }
    } catch (error: any) {
      lastError = error;
      console.error(`💥 [AFTERSHIP] Attempt ${attempt}/${maxRetries} failed:`, error.message);
      await closePage(page);
      if (attempt < maxRetries) {
        await waitBeforeRetry(attempt);
      }
    }
  }

  console.error(`💥 [AFTERSHIP] All ${maxRetries} attempts failed`);
  throw lastError || new Error('Failed to capture screenshot after all retries');
}

export async function aftershipScreenshouter({ codes, provider }: ScreenshotQuery): Promise<{ status: string; buffer: Buffer }> {
  console.log(`📍 [AFTERSHIP] Starting screenshot for tracking: ${codes}`);

  const browserContext = await PlaywrightBrowserSingleton.getContext();
  if (!browserContext) {
    throw new Error('Failed to get browser context');
  }

  const maxRetries = 3;

  try {
    const { buffer, status } = await retryScreenshotCapture({ browserContext, codes, provider, maxRetries });

    const statusArray = status.split(',');
    const allDelivered = statusArray.every(s => s === 'DELIVERED');

    return {
      buffer,
      status: allDelivered ? 'DELIVERED' : 'UNKNOWN'
    };
  } catch (error) {
    console.error(`💥 [AFTERSHIP] Error in aftershipScreenshouter:`, error);
    throw error;
  }
}