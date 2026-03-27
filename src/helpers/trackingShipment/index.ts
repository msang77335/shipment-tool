import { isASENDIA, isGiaoHangNhanh, isOnTrac, isSPX, isYunExpress } from "../";
import { PlaywrightBrowserSingleton } from "../PlaywrightBrowserSingleton";

async function navigateToPage(page: any, url: string): Promise<void> {
  console.log(`🌐 [TRACKING SHIPMENT] Navigating to ${url}...`);

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
  } catch (gotoError: any) {
    console.log(`⚠️ [TRACKING SHIPMENT] Navigation issue: ${gotoError.message}, retrying with 'load'...`);
    await page.goto(url, {
      waitUntil: 'load',
      timeout: 60000
    });
  }
}

async function checkTrackingData(page: any): Promise<boolean> {
  console.log(`🔍 [TRACKING SHIPMENT] Checking for tracking data...`);
  return await page.evaluate(() => {
    const spxHasData = (globalThis as any).document.querySelector('.comp-tracking-milestone-progress-bar');
    const ghnHasData = (globalThis as any).document.querySelector('.order-history-container')?.textContent?.trim().length > 0;
    
    // Check YunExpress has table and not "No data"
    const yunTableHeader = (globalThis as any).document.querySelector('.el-table__header-wrapper');
    const yunNoData = (globalThis as any).document.body?.textContent?.includes('No data');
    const yunHasData = yunTableHeader && !yunNoData;

    // Check OnTrac: has data when events list has rows and no error message visible
    const ontracErrorMsg = (globalThis as any).document.querySelector('#js-track-error-message');
    const ontracErrorVisible = ontracErrorMsg?.style?.display === 'block';
    const ontracHasData = !(ontracErrorVisible && ontracErrorMsg?.textContent?.includes('No tracking information for'));

    return spxHasData || ghnHasData || yunHasData || ontracHasData;
  });
}

async function getTrackingStatus(page: any, provider: string): Promise<string> {
  if (isSPX(provider)) {
    console.log(`📊 [TRACKING SHIPMENT] Getting tracking status for SPX...`);
    return await page.evaluate(() => {
      // Check various delivery status indicators
      const messageElement = (globalThis as any).document.querySelector('.message');
      const statusText = messageElement?.textContent?.trim() || '';

      // Check for successful delivery only
      if (statusText.includes('Giao hàng thành công') ||
        statusText.includes('Đã giao hàng') ||
        statusText.includes('Delivered')) {
        return 'DELIVERED';
      }

      // All other cases
      return 'UNKNOWN';
    });
  } else if(isGiaoHangNhanh(provider)) {
    console.log(`📊 [TRACKING SHIPMENT] Getting tracking status for GiaoHangNhanh...`);
    return await page.evaluate(() => {
      // Check for delivery status in table or log items
      const statusElements = (globalThis as any).document.querySelectorAll('.table-col.text-bold, .table-log-item .table-col');
      
      for (const element of statusElements) {
        const statusText = element?.textContent?.trim() || '';
        
        // Check for successful delivery
        if (statusText.includes('Giao hàng thành công') ||
            statusText.includes('Đã giao hàng') ||
            statusText.includes('Delivered')) {
          return 'DELIVERED';
        }
      }
      
      // All other cases
      return 'UNKNOWN';
    });
  } else if (isYunExpress(provider)) {
    console.log(`📊 [TRACKING SHIPMENT] Getting tracking status for YunExpress...`);
    return await page.evaluate(() => {
      // Check for status element
      const statusElement = (globalThis as any).document.querySelector('.status');
      const statusText = statusElement?.textContent?.trim() || '';
      
      // Check for successful delivery
      if (statusText.includes('Delivered successfully') ||
          statusText.includes('Giao hàng thành công') ||
          statusText.includes('Đã giao hàng') ||
          statusText.includes('Delivered')) {
        return 'DELIVERED';
      }
      
      // All other cases
      return 'UNKNOWN';
    });
  } else if (isOnTrac(provider)) {
    console.log(`📊 [TRACKING SHIPMENT] Getting tracking status for OnTrac...`);
    return await page.evaluate(() => {
      const doc = (globalThis as any).document;

      // Check main status heading
      const eventFormatted = doc.querySelector('h2[name="EventFormatted"], .section-title[name="EventFormatted"]');
      const eventFormattedText = eventFormatted?.textContent?.trim() || '';

      // Check short description (e.g. "Package Delivered")
      const shortDesc = doc.querySelector('p[name="EventShortDescriptionFormatted"]');
      const shortDescText = shortDesc?.textContent?.trim() || '';

      // Check first event row in table
      const firstEventCell = doc.querySelector('#js-track-events-list tr td:nth-child(2)');
      const firstEventText = firstEventCell?.textContent?.trim() || '';

      const allText = `${eventFormattedText} ${shortDescText} ${firstEventText}`.toLowerCase();

      if (allText.includes('delivered')) {
        return 'DELIVERED';
      }

      return 'UNKNOWN';
    });
  } else if (isASENDIA(provider)) {
    console.log(`📊 [TRACKING SHIPMENT] Getting tracking status for Asendia...`);
    return await page.evaluate(() => {
      const doc = (globalThis as any).document;

      // Method 1: Check delivery_status from table
      const deliveryStatusCell = doc.querySelector('[data-column-id="delivery_status"]');
      const deliveryStatusText = deliveryStatusCell?.textContent?.trim() || '';
      
      if (deliveryStatusText.includes('Delivered') || 
          deliveryStatusText.includes('Giao hàng thành công') || 
          deliveryStatusText.includes('Đã giao hàng')) {
        return 'DELIVERED';
      }

      // Method 2: Check stepper milestones for completed "Delivered" status
      // The stepper shows steps: find "Delivered" step and check if it's completed
      const stepperButtons = doc.querySelectorAll('.ParcelStatus_stepperMilestone__vqH9j');
      
      // Find the Delivered step (usually the last one with icon-Delivered)
      for (const button of stepperButtons) {
        const icon = button.querySelector('.icon-Delivered');
        if (icon) {
          // Check if this step is marked as done (has blue color/completed style)
          const checkboxDiv = button.querySelector('.Stepper_done__B77P3');
          if (checkboxDiv) {
            // If Delivered step has a checkmark, it's delivered
            return 'DELIVERED';
          }
        }
      }

      // Method 3: Check event status text in events table
      const eventStatusCells = doc.querySelectorAll('[data-column-id="3"]');
      for (const cell of eventStatusCells) {
        const eventText = cell.textContent?.toLowerCase() || '';
        if (eventText.includes('delivered')) {
          return 'DELIVERED';
        }
      }

      return 'UNKNOWN';
    });
  }
  return 'UNKNOWN';
}

async function takePage(page: any): Promise<Buffer> {
  console.log(`✅ [TRACKING SHIPMENT] Tracking data found, taking screenshot...`);
  const screenshot = await page.screenshot({ fullPage: false });
  console.log(`✅ [TRACKING SHIPMENT] Screenshot captured, size: ${screenshot.length} bytes`);
  console.log(`✨ [TRACKING SHIPMENT] All done!`);
  return Buffer.from(screenshot);
}

async function closePage(page: any): Promise<void> {
  if (page && !page.isClosed()) {
    await page.close().catch((e: any) => console.log('Error closing page:', e));
  }
}

export async function trackingShipment(url: string, provider: string): Promise<{ status: string; buffer: Buffer }> {
  console.log(`📍 [TRACKING SHIPMENT] Starting screenshot for URL: ${url}`);
  const browserContext = await PlaywrightBrowserSingleton.getContextWithoutProxy();
  if (!browserContext) {
    throw new Error('Failed to get browser context');
  }

  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let page;
    try {
      console.log(`🆕 [TRACKING SHIPMENT] Creating new page (attempt ${attempt}/${maxRetries})...`);
      page = await browserContext.newPage();

      page.setDefaultTimeout(90000); // 90 seconds
      console.log(`⏱️ [TRACKING SHIPMENT] Default timeout set to 90 seconds`);

      await navigateToPage(page, url);
      console.log(`✅ [TRACKING SHIPMENT] Page loaded successfully`);

      console.log(`⏳ [TRACKING SHIPMENT] Waiting 15 seconds for content to load...`);
      await new Promise(resolve => setTimeout(resolve, 15000));

      const hasTrackingData = await checkTrackingData(page);

      if (hasTrackingData) {
        const status = await getTrackingStatus(page, provider);
        console.log(`📊 [TRACKING SHIPMENT] Status detected: ${status}`);

        const buffer = await takePage(page);

        const metadata = {
          url: url,
          timestamp: new Date().toISOString()
        };

        await closePage(page);
        return { status, buffer };
      }

      console.error(`⚠️ [TRACKING SHIPMENT] No tracking data found (attempt ${attempt}/${maxRetries})`);
      const buffer = await page.screenshot({ fullPage: false });
      await closePage(page);
      return {
        status: 'UNKNOWN',
        buffer: Buffer.from(buffer)
      }
    } catch (error: any) {
      lastError = error;
      console.error(`💥 [TRACKING SHIPMENT] Attempt ${attempt}/${maxRetries} failed:`, error.message);
      await closePage(page);

      if (attempt < maxRetries) {
        const delay = attempt * 2000; // Exponential backoff
        console.log(`⏳ [TRACKING SHIPMENT] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`💥 [TRACKING SHIPMENT] All ${maxRetries} attempts failed`);
  throw lastError;
}