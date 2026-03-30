import axios from "axios";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { env } from '../env';
import { ProxyInfo } from '../proxyManager';
import { aftershipTrackingShipment } from "./aftershipTrackingShipment";
import { convertToStandardFormat, parseHtmlTrackingResponse } from './htmlTrackingParser';import { PlaywrightBrowserSingleton } from '../PlaywrightBrowserSingleton';
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

const trackingJnTPage = async (codes: string) => {
  const jntPhoneList = env.jntPhoneList ? env.jntPhoneList.split(',') : [];
  try {
    const requests = jntPhoneList?.map(phone =>
      processingTracking(phone.trim(), codes, env.proxies[Math.floor(Math.random() * env.proxies.length)])
    ) || [];
    const results = await Promise.all(requests);

    const flattenedResults = results.flat();

    const codeLength = codes.split(',').length;

    if (flattenedResults?.length < codeLength) {
      return {
        success: false,
        data: null,
        error: `Tracking information found for ${flattenedResults.length} out of ${codeLength} tracking number(s)`
      };
    }

    return {
      success: true,
      data: flattenedResults,
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

const processingTracking = async (cellPhone: string, codes: string, proxy: ProxyInfo) => {
  try {
    const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.server}`;
    const requestConfig = {
      params: {
        type: 'track',
        billcode: codes,
        cellphone: cellPhone,
        httpAgent: new HttpProxyAgent(proxyUrl),
        httpsAgent: new HttpsProxyAgent(proxyUrl),
      },
      timeout: 15000,
      validateStatus: () => true
    };

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

export const jntShipmentTrackingShipment = async (codes: string) => {
  const trackingData = await trackingJnTPage(codes);
  if (trackingData.success) {
    return {
      status: "DELIVERED",
      buffer: Buffer.from(JSON.stringify(trackingData.data), 'utf-8')
    };
  } else {
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
    
    const lastEvent = history[history.length - 1];
    const statusText = lastEvent?.status || '';
    
    // Check if last event contains "ký nhận" (received/signed)
    return statusText.includes('ký nhận');
  });

  return allDelivered ? "DELIVERED" : "UNKNOWN";
}

/**
 * Render shipment tracking data as HTML buffer
 */
export const renderShipmentHtml = async (codes: string): Promise<Buffer> => {
  let page;
  try {
    const trackingData = await trackingJnTPage(codes);

    const templatePath = join(__dirname, '../../..', 'templates', 'shipment-list.html');
    let htmlTemplate = readFileSync(templatePath, 'utf-8');

    // Inject shipment data as JSON
    const shipmentJson = JSON.stringify(trackingData.success ? trackingData.data : []);
    htmlTemplate = htmlTemplate.replace('{DATA_PLACEHOLDER}', shipmentJson);

    // Determine overall status based on last events
    const shipmentsData = trackingData.success && trackingData.data ? trackingData.data : [];
    const overallStatus = determineOverallStatus(shipmentsData);
    console.log(`✅ [J&T] Overall status: ${overallStatus}`);

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
    await page.setViewportSize({ width: 900, height: 600 });
    await page.setContent(html, { waitUntil: 'networkidle' });

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true
    });

    return Buffer.from(screenshot);
  } catch (error) {
    // If screenshot fails, return simple error as UTF-8 buffer
    return Buffer.from(html, 'utf-8');
  } finally {
    if (page) await page.close();
  }
}