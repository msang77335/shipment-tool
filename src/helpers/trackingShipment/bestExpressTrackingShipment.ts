import { getNextBrowserlessToken } from '..';

const TRACKING_SITE = {
  TRACKING_MORE: {
    url: (codes: string) => `https://www.trackingmore.com/track?number=${codes}&express=best-vn`,
    query: `mutation Screenshot($url: String!) { 
      viewport(width: 1280, height: 720, deviceScaleFactor: 1) { width height deviceScaleFactor }
      goto(url: $url, waitUntil: load) { status } 
      solve { found solved time } 
      waitForTimeout(time: 15000) { time } 
      trackingStatus: text(selector: ".num-status-info .status-color") { text }
      screenshot(type: jpeg) { base64 } 
    }`
  },
  PARCELP_PANEL: {
    url: (codes: string) => `https://www.parcelpanel.com/track/?tn=${codes}&cd=best-vn`,
    query: `mutation Screenshot($url: String!) { 
      viewport(width: 1280, height: 1080, deviceScaleFactor: 1) { width height deviceScaleFactor }
      goto(url: $url, waitUntil: load) { status } 
      solve { found solved time } 
      waitForTimeout(time: 15000) { time } 
      trackingStatus: text(selector: ".overflow-hidden-line span") { text }
      screenshot(type: jpeg) { base64 } 
    }`
  }
}

export async function bestExpressTrackingShipment(codes: string): Promise<{ status: string; buffer: Buffer }> {
  console.log(`📍 [BEST EXPRESS] Starting screenshot for tracking: ${codes}`);

  const token = getNextBrowserlessToken();
  if (!token) {
    throw new Error('No Browserless API token available');
  }

  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");

  const graphql = JSON.stringify({
    query: TRACKING_SITE.PARCELP_PANEL.query,
    variables: { "url": TRACKING_SITE.PARCELP_PANEL.url(codes) }
  });

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: graphql
  };

  try {
    console.log(`🌐 [BEST EXPRESS] Calling browserless.io API...`);
    const response = await fetch(
      `https://production-sfo.browserless.io/chromium/bql?token=${token}`,
      requestOptions
    );

    if (!response.ok) {
      throw new Error(`Browserless API returned status ${response.status}: ${await response.text()}`);
    }

    const result = await response.json() as {
      data?: {
        screenshot?: {
          base64?: string;
        };
        trackingStatus?: {
          text?: string;
        }
      };
    };
    console.log(`📦 [BEST EXPRESS] Received response from browserless.io`);

    if (!result.data?.screenshot?.base64) {
      throw new Error('No screenshot data in response');
    }

    const screenshotBuffer = Buffer.from(result.data.screenshot.base64, 'base64');
    console.log(`✅ [BEST EXPRESS] Screenshot completed successfully, size: ${screenshotBuffer.length} bytes`);

    const trackingStatusText = result.data?.trackingStatus?.text || '';

    const isDelivered = trackingStatusText.toUpperCase().includes('DELIVERED');

    return {
      status: isDelivered ? 'DELIVERED' : 'UNKNOWN',
      buffer: screenshotBuffer
    };
  } catch (error) {
    console.error(`💥 [BEST EXPRESS] Error in isBestExpressScreenshouter:`, error);
    throw error;
  }
}