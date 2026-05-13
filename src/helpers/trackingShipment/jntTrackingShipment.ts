import axios from "axios";
import * as cheerio from 'cheerio';
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { replace } from "lodash";
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PlaywrightBrowserSingleton } from "../browser/PlaywrightBrowserSingleton";
import { phoneManager } from "../jnt/phone";
import { trackingHistManager } from "../jnt/trackingHist";
import { ProxyInfo, proxyManager } from '../proxy';
import { env } from "../env";
import { aftershipTrackingShipment } from "./aftershipTrackingShipment";
const trackingUrl = "https://jtexpress.vn/vi/tracking";

const headers = {
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,vi;q=0.6',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'Origin': 'https://jtexpress.vn',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  'X-OCTOBER-REQUEST-HANDLER': 'onSearchPriceList',
  'X-OCTOBER-REQUEST-PARTIALS': 'search/pricelist/result-list-search',
  'X-Requested-With': 'XMLHttpRequest',
  'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"'
}

const axiosclient = axios.create({
  headers,
  timeout: 10000,
  validateStatus: () => true
});

const trackingJnTPage = async ({ codes, bankAccountName }: { codes: string; bankAccountName?: string }) => {
  const phoneList = await phoneManager.getPhonesByName(bankAccountName || '') || [];
  if (phoneList.length === 0) {
    console.warn(`⚠️ [JNT TRACKING] No phones found for bank account name: "${bankAccountName}". Proceeding without phone numbers.`);
    return {
      success: false,
      data: null,
      error: `No phones available for bank account name: "${bankAccountName}". Please add phones to the pool or check the name.`
    };
  }

  try {
    const dedupedResults = await trackWithPhones(phoneList, codes);

    const codeLength = codes.split(',').length;

    if (dedupedResults?.length < codeLength) {
      return {
        success: false,
        data: null,
        error: `Tracking information found for ${dedupedResults.length} out of ${codeLength} tracking number(s)`
      };
    }

    return {
      success: true,
      data: dedupedResults,
    };
  } catch (error) {
    console.error(`Error tracking J&T shipment ${codes}:`, error);
    throw error;
  }
};

/**
 * Check if the response is HTML content
 */
const isHtmlResponse = (data: any): boolean => {
  if (typeof data !== 'string') {
    return false;
  }
  // Check for common HTML indicators
  return /<!DOCTYPE|<html|<div class="result_vandon"/.test(data.substring(0, 500));
};

export const processingTracking = async (cellPhone: string, codes: string, proxy: ProxyInfo | null) => {
  const requestConfig: any = {
    params: {
      type: 'track',
      billcode: codes,
      cellphone: cellPhone,
    },
    timeout: 30000,
    validateStatus: () => true,
  };
  try {
    if (proxy) {
      const username = proxy.username?.trim();
      const password = proxy.password?.trim();
      let server = proxy.server?.trim();

      // Validate all proxy components are non-empty
      if (username && password && server) {
        // Remove protocol prefix if present (proxy.server comes as "http://ip:port")
        server = server.replace(/^https?:\/\//, '');

        const encodedUsername = encodeURIComponent(username);
        const encodedPassword = encodeURIComponent(password);
        const proxyUrl = `http://${encodedUsername}:${encodedPassword}@${server}`;
        requestConfig.httpAgent = new HttpProxyAgent(proxyUrl);
        requestConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
      }
    }
    const response = await axiosclient.get(
      trackingUrl,
      requestConfig
    );

    if (isHtmlResponse(response.data)) {
      const parsedShipments = parseHtmlTrackingResponse(response.data);
      return convertToStandardFormat(parsedShipments);
    } else if (typeof response.data === 'object' && response.data.success) {
      return response.data;
    } else {
      console.log(`Unexpected response format for ${cellPhone} with codes ${codes}:`, response.data);
      return [];
    }
  } catch (error) {
    console.log(`Error processing tracking for ${cellPhone} with codes ${codes}:`, error);
    return [];
  }
};

const TRACKING_BATCH_SIZE = 5;

export const trackWithPhones = async (phones: string[], codes: string): Promise<any[]> => {
  const codeCount = codes.split(',').filter(Boolean).length;
  const seenTrackingNumbers = new Set<string>();
  const allResults: any[] = [];
  const proxies = proxyManager.getAllProxies();

  let proxyIndex = 0;

  for (let i = 0; i < phones.length; i += TRACKING_BATCH_SIZE) {
    const batch = phones.slice(i, i + TRACKING_BATCH_SIZE);
    const batchResults: any[] = [];
    for (const phone of batch) {
      const proxy = proxies.length > 0 ? proxies[proxyIndex % proxies.length] : null;
      if (proxies.length > 0) proxyIndex++;
      const result = await processingTracking(phone.trim(), codes, proxy);
      await new Promise(resolve => setTimeout(resolve, 3500));
      batchResults.push(result);
    }
    const flatBatch = batchResults.flat();

    for (const result of flatBatch) {
      if (!seenTrackingNumbers.has(result.trackingNumber)) {
        seenTrackingNumbers.add(result.trackingNumber);
        allResults.push(result);
      }
    }

    // Early exit once we have results for all tracking codes
    if (allResults.length >= codeCount) {
      break;
    }

    // Small delay between batches to avoid overwhelming the server
    if (i + TRACKING_BATCH_SIZE < phones.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return allResults;
};

const resizeImageViaPlaywright = async (imagePath: string, width: number): Promise<Buffer> => {
  let page;
  try {
    const browserContext = await PlaywrightBrowserSingleton.getContextWithoutProxy();
    if (!browserContext) {
      return readFileSync(imagePath);
    }
    page = await browserContext.newPage();
    await page.setViewportSize({ width, height: 1 });
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0}body{width:${width}px}img{width:100%;display:block}</style></head><body><img src="file://${imagePath}"></body></html>`;
    await page.setContent(html, { waitUntil: 'networkidle' });
    const screenshot = await page.screenshot({ type: 'png', fullPage: true });
    return Buffer.from(screenshot);
  } catch (error) {
    console.error('Error resizing image via Playwright:', error);
    return readFileSync(imagePath);
  } finally {
    if (page) await page.close();
  }
};

export const jntShipmentTrackingShipment = async ({ codes, bankAccountName }: { codes: string; bankAccountName?: string }) => {
  const trackingData = await trackingJnTPage({ codes, bankAccountName });
  if (trackingData.success) {
    const overallStatus = determineOverallStatus(trackingData?.data ?? []);
    const buffer = await renderShipmentHtml({ success: trackingData?.success, data: trackingData.data ?? [] });
    console.log(`✅ [J&T TRACKING] Tracking completed for codes: ${codes}, Overall Status: ${overallStatus}, Image Size: ${buffer.length} bytes`);
    return {
      status: overallStatus,
      buffer: buffer
    };
  } else {
    const codesPlitted = codes.split(',').map(code => code.trim()).filter(Boolean);
    if (codesPlitted.length > 1) {
      const accountName = bankAccountName?.replaceAll(/\s/g, '') || '';
      await trackingHistManager.addHist(codes, accountName, "AfterShip");
    }
    
    if (!env.aftershipEnabled) {
      console.warn(`⚠️ [J&T TRACKING] AfterShip is disabled (AFTERSHIP_ENABLED != true). Returning quota-exceeded image.`);
      const quotaExceededPath = join(__dirname, '../../../public', 'aftership-quota-exceeded.png');
      const buffer = await resizeImageViaPlaywright(quotaExceededPath, 1200);
      return {
        status: "UNKNOWN",
        buffer,
      };
    }

    return aftershipTrackingShipment({ codes, provider: "J&T" });
  }
};

/**
 * Determine overall tracking status based on last events of all shipments
 * Returns "DELIVERED" if all shipments' last events indicate "ký nhận" (signed/received)
 * Otherwise returns "UNKNOWN"
 */
function determineOverallStatus(shipments: any[]): string {
  if (!shipments || shipments.length === 0) {
    return "UNKNOWN";
  }

  const allDelivered = shipments.every(shipment => {
    const history = shipment.history || [];
    if (history.length === 0) return false;

    // Check if any event contains "Đơn hàng đã ký nhận" (delivered/signed)
    return history.some((event: any) => {
      const statusText = (event?.status || '').normalize('NFC');
      return statusText.includes('Đơn hàng đã ký nhận'.normalize('NFC'));
    });
  });

  return allDelivered ? "DELIVERED" : "UNKNOWN";
}

/**
 * Render shipment tracking data as HTML buffer
 */
export const renderShipmentHtml = async (trackingData: { success: boolean; data: any[] }): Promise<Buffer> => {
  let page;
  try {
    const templatePath = join(__dirname, '../../templates', 'jnt-tracking.html');
    let htmlTemplate = readFileSync(templatePath, 'utf-8');

    // Inject shipment data as JSON
    const shipmentJson = JSON.stringify(trackingData.success ? trackingData.data : []);
    htmlTemplate = htmlTemplate.replace('{DATA_PLACEHOLDER}', shipmentJson);

    // Get browser context and create page
    const browserContext = await PlaywrightBrowserSingleton.getContextWithoutProxy();
    if (!browserContext) {
      throw new Error('Failed to get browser context');
    }

    page = await browserContext.newPage();

    // Load HTML content
    await page.setContent(htmlTemplate, { waitUntil: 'networkidle' });

    // Wait for animations to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true
    });

    console.log(`✅ [J&T HTML RENDER] Screenshot rendered, size: ${screenshot.length} bytes`);

    // Return with overall status
    return Buffer.from(screenshot);
  } catch (error) {
    console.error('Error rendering shipment HTML screenshot:', error);
    // Return error page as buffer
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Lỗi</title>
        </head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>Lỗi khi tải dữ liệu</h1>
          <p>${error instanceof Error ? error.message : 'Lỗi không xác định'}</p>
        </body>
      </html>
    `;
    const errorScreenshot = await renderErrorPage(errorHtml);
    return errorScreenshot;
  } finally {
    if (page) await page.close();
  }
};

/**
 * Render error page as screenshot
 */
async function renderErrorPage(html: string): Promise<Buffer> {
  let page;
  try {
    const browserContext = await PlaywrightBrowserSingleton.getContextWithoutProxy();
    if (!browserContext) {
      return Buffer.from(html);
    }

    page = await browserContext.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true
    });

    return Buffer.from(screenshot);
  } catch (error) {
    console.error('Error rendering error page:', error);
    return Buffer.from(html);
  } finally {
    if (page) await page.close();
  }
}

interface TrackingEvent {
  timestamp: string;
  date: string;
  status: string;
  location?: string;
  name?: string;
  phone?: string;
}

interface ShipmentTracking {
  trackingNumber: string;
  events: TrackingEvent[];
  currentStatus?: string;
  lastUpdate?: string;
}

/**
 * Parse HTML tracking page and extract shipment information
 * Handles the HTML response format from J&T tracking page
 */
const parseHtmlTrackingResponse = (htmlContent: string): ShipmentTracking[] => {
  const $ = cheerio.load(htmlContent);
  const shipments: ShipmentTracking[] = [];

  // Find all shipment sections (each has a tracking number header)
  const shipmentSections = $('div.result_vandon');

  shipmentSections.each((index, section) => {
    const $section = $(section);

    // Extract tracking number from header
    const headerSpan = $section.find(String.raw`span.text-grey-darkest.font-thin`);
    const trackingNumber = headerSpan.text().trim();

    if (!trackingNumber) {
      return; // Skip if no tracking number found
    }

    // Extract all tracking events
    const events: TrackingEvent[] = [];
    const trackingItems = $section.find('div.result-vandon-item');

    trackingItems.each((eventIndex, item) => {
      const $item = $(item);

      // Extract time
      const timeSpan = $item.find(String.raw`span.text-\[14px\].SFProDisplayBold`).first();
      const timestamp = timeSpan.text().trim();

      // Extract date - look for span with date pattern (YYYY-MM-DD)
      let date = '';
      $item.find('span').each((idx, span) => {
        const text = $(span).text().trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
          date = text;
        }
      });

      // Extract status description (the main div after timestamp/date)
      const statusDiv = $item.find('div').last();
      const fullText = statusDiv.text().trim();

      // Parse the status text to extract components
      const { status, location, name, phone } = parseStatusText(fullText);

      events.push({
        timestamp,
        date,
        status,
        location,
        name,
        phone,
      });
    });

    // Determine current status (first event is most recent in Vietnamese tracking)
    const currentStatus = events.length > 0 ? events[0].status : undefined;
    const lastUpdate = events.length > 0 ? `${events[0].date} ${events[0].timestamp}` : undefined;

    shipments.push({
      trackingNumber,
      events: events, // Reverse to show chronological order (oldest to newest)
      currentStatus,
      lastUpdate,
    });
  });

  return shipments;
};

/**
 * Parse Vietnamese status text to extract components
 * Examples:
 * - "Đơn hàng đã ký nhận. Người ký nhận là:【Huynh Phuong】"
 * - "Nhân viên【Nguyễn Dương Quốc Anh】của bưu cục 【(ĐNI) Định Quán】đang giao hàng.【+84365874421】"
 * - "Hàng đã được chuyển đến【(ĐNI) Định Quán】"
 */
const parseStatusText = (
  text: string
): {
  status: string;
  location?: string;
  name?: string;
  phone?: string;
} => {
  // Remove HTML tags and clean up
  const cleanText = replace(text, /<[^>]*>/g, '').trim();

  // Extract phone number (format: +84xxxxxxxxx)
  const phoneMatch = new RegExp(/\+84\d{9,}/, 'g').exec(cleanText);
  const phone = phoneMatch ? phoneMatch[0] : undefined;

  // Extract text in 【】 brackets
  const bracketMatches = cleanText.match(/【([^】]*)】/g);
  const brackets: string[] = [];
  if (bracketMatches) {
    bracketMatches.forEach((match) => {
      const content = match.trim();
      if (content) {
        brackets.push(content);
      }
    });
  }

  // Try to identify location and name from brackets
  let name: string | undefined;
  let location: string | undefined;

  brackets.forEach((bracket) => {
    // Location usually starts with ( or contains keywords like "bưu cục", "Pickup", "ĐGP", etc.
    if (
      bracket.startsWith('(') ||
      bracket.includes('bưu cục') ||
      bracket.includes('Pickup') ||
      bracket.includes('ĐGP') ||
      bracket.includes('TTKT')
    ) {
      location = bracket;
    } else if (!bracket.startsWith('+')) {
      // If not a phone number and not a location, likely a name
      name = bracket;
    }
  });

  return {
    status: cleanText,
    location: location,
    name: name,
    phone: phone,
  };
};

/**
 * Convert parsed tracking data to standard format
 */
const convertToStandardFormat = (shipments: ShipmentTracking[]) => {
  return shipments.map((shipment) => ({
    trackingNumber: shipment.trackingNumber,
    status: shipment.currentStatus,
    lastUpdated: shipment.lastUpdate,
    history: shipment.events,
  }));
};
