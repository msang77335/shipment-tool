import { Page } from 'playwright';
import { applyStealthPatches, captureLastAttemptScreenshot, captureScreenshot, closePage, createPage, isDHL, isJTExpress, isUSPS, proxyManager, ScreenshotQuery, setStealthHeaders, waitBeforeRetry } from "..";
import { PlaywrightBrowserSingleton } from '../browser/PlaywrightBrowserSingleton';

const getTrackingURL = (codes: string, provider: string) => {
  if (isJTExpress(provider)) {
    return `https://www.aftership.com/track?c=jtexpress-vn&t=${codes}`;
  } else if (isUSPS(provider)) {
    return `https://www.aftership.com/track?c=usps-vn&t=${codes}`;
  } else if (isDHL(provider)) {
    return `https://www.aftership.com/track/${codes}`;
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

async function checkForQuotaOrBlockingIssues(page: Page): Promise<boolean> {
  console.log(`🔍 [AFTERSHIP] Checking for quota/blocking issues...`);
  return await page.evaluate(() => {
    const pageText = (globalThis as any).document.body.innerText || '';
    
    return pageText.includes('Quota Exceeded');
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

async function attemptScreenshot({ page, codes, provider, attempt, maxRetries }: { page: Page; codes: string; provider: string; attempt: number; maxRetries: number; }): Promise<{ buffer: Buffer; status: string } | null> {
  const trackingURL = getTrackingURL(codes, provider);
  await navigateAndSolveRecaptcha(page, trackingURL, attempt, maxRetries);

  // Check for quota/blocking issues first
  const hasBlockingIssue = await checkForQuotaOrBlockingIssues(page);
  if (hasBlockingIssue) {
    console.log(`🛑 [AFTERSHIP] Quota/blocking issue detected on page`);
    // Add to blacklist and remove from proxy pool
    const currentProxyServer = PlaywrightBrowserSingleton.getCurrentProxyServer();
    proxyManager.addToBlacklist({
      provider,
      proxyServer: currentProxyServer,
      reason: 'QUOTA_EXCEEDED',
      code: codes
    });
    
    // Remove proxy from pool immediately
    if (currentProxyServer) {
      await proxyManager.removeProxy(currentProxyServer);
      console.log(`✅ [AFTERSHIP] Removed proxy ${currentProxyServer} from pool due to QUOTA_EXCEEDED`);
    }
    return null; // Signal retry with context close
  }

  const hasTrackingData = await checkTrackingData(page);

  if (hasTrackingData) {
    const { status } = await getAllShipments(page);

    console.log(`✅ [AFTERSHIP] Tracking data found: ${status}`);

    const buffer = await captureScreenshot(page);
    return { buffer, status };
  }

  // No blocking issue AND no tracking data found → add to gray list
  console.log(`⚠️ [AFTERSHIP] No tracking data found (not a blocking issue)`);

  return null;
}

async function handleBlockingIssue(page: Page): Promise<void> {
  console.log(`🛑 [AFTERSHIP] Quota/blocking issue detected - closing context and will retry with new context`);
  const currentProxyServer = PlaywrightBrowserSingleton.getCurrentProxyServer();
  if (currentProxyServer) {
    await PlaywrightBrowserSingleton.closeContextForProxy(currentProxyServer);
    console.log(`✅ [AFTERSHIP] Context closed for proxy ${currentProxyServer}`);
  }
}

async function cleanupContextOnError(browserContext: any): Promise<void> {
  if (browserContext) {
    try {
      const currentProxyServer = PlaywrightBrowserSingleton.getCurrentProxyServer();
      if (currentProxyServer) {
        await PlaywrightBrowserSingleton.closeContextForProxy(currentProxyServer);
      }
    } catch (closeError) {
      console.error(`⚠️ [AFTERSHIP] Failed to close context on error:`, closeError);
    }
  }
}

async function setupPageWithContext(attempt: number, maxRetries: number): Promise<{ browserContext: any; page: Page }> {
  console.log(`🆕 [AFTERSHIP] Getting browser context (attempt ${attempt}/${maxRetries})...`);
  const browserContext = await PlaywrightBrowserSingleton.getContextWithProxy();
  if (!browserContext) {
    throw new Error('Failed to get browser context');
  }

  console.log(`🆕 [AFTERSHIP] Creating new page (attempt ${attempt}/${maxRetries})...`);
  const page = await createPage(browserContext);

  await applyStealthPatches(page);
  await setStealthHeaders(page);

  return { browserContext, page };
}

async function handleNoDataResult(page: Page, attempt: number, maxRetries: number): Promise<{ buffer: Buffer; status: string } | null> {
  const hasBlockingIssue = await checkForQuotaOrBlockingIssues(page);
  if (hasBlockingIssue) {
    await handleBlockingIssue(page);
  }

  if (attempt < maxRetries) {
    await closePage(page);
    console.log(`⏳ [AFTERSHIP] No data found, waiting before retry ${attempt}/${maxRetries}...`);
    await waitBeforeRetry(attempt);
    return null;
  }

  console.log(`⚠️ [AFTERSHIP] Last attempt - capturing screenshot anyway`);
  return await captureLastAttemptScreenshot(page);
}

async function retryScreenshotCapture({ codes, provider, maxRetries }: { codes: string; provider: string; maxRetries: number; }): Promise<{ buffer: Buffer; status: string }> {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let page: Page | undefined;
    let browserContext: any = null;

    try {
      const setup = await setupPageWithContext(attempt, maxRetries);
      page = setup.page;
      browserContext = setup.browserContext;

      const result = await attemptScreenshot({ page, codes, provider, attempt, maxRetries });

      if (result) {
        await closePage(page);
        console.log(`✅ [AFTERSHIP] Successfully captured screenshot on attempt ${attempt}`);
        return result;
      }

      const noDataResult = await handleNoDataResult(page, attempt, maxRetries);
      if (noDataResult) {
        return noDataResult;
      }
    } catch (error: any) {
      lastError = error;
      console.error(`💥 [AFTERSHIP] Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      await cleanupContextOnError(browserContext);
      await closePage(page);
      
      if (attempt < maxRetries) {
        await waitBeforeRetry(attempt);
      }
    }
  }

  console.error(`💥 [AFTERSHIP] All ${maxRetries} attempts failed`);
  throw lastError || new Error('Failed to capture screenshot after all retries');
}

export async function aftershipTrackingShipment({ codes, provider }: ScreenshotQuery): Promise<{ status: string; buffer: Buffer }> {
  console.log(`📍 [AFTERSHIP] Starting screenshot for tracking: ${codes}`);

  const maxRetries = 3;

  try {
    const { buffer, status } = await retryScreenshotCapture({ codes, provider, maxRetries });

    const statusArray = status.split(',');
    const allDelivered = statusArray.every(s => s === 'DELIVERED');

    return {
      buffer,
      status: allDelivered ? 'DELIVERED' : 'UNKNOWN'
    };
  } catch (error) {
    console.error(`💥 [AFTERSHIP] Error in aftershipTrackingShipment:`, error);
    throw error;
  }
}