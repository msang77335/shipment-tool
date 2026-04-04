import { getNextBrowserlessToken } from '..';

interface ScreenshotQuery {
  codes: string;
}

export async function dhlTrackingShipment({ codes }: ScreenshotQuery): Promise<{ status: string; buffer: Buffer }> {
  console.log(`📍 [DHL] Starting screenshot for tracking code: ${codes}`);

  const token = getNextBrowserlessToken();
  if (!token) {
    throw new Error('No Browserless API token available');
  }

  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");

  const trackingUrl = `https://www.dhl.de/en/privatkunden/pakete-empfangen/verfolgen.html?piececode=${codes}`;

  const graphql = JSON.stringify({
    query: `mutation Screenshot($url: String!) { 
      viewport(width: 1280, height: 1280, deviceScaleFactor: 1) { width height deviceScaleFactor }
      goto(url: $url, waitUntil: load) { status } 
      waitAfterLoad: waitForTimeout(time: 10000) { time }
      click(selector: "#onetrust-accept-btn-handler") { __typename }
      waitAfterClick: waitForTimeout(time: 5000) { time }
      trackingStatusText: text(selector: "strong[data-role='shipment-status-text']") { text }
      screenshot(type: jpeg) { base64 } 
    }`,
    variables: { "url": trackingUrl }
  });

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: graphql
  };

  try {
    console.log(`🌐 [DHL] Calling browserless.io API for URL: ${trackingUrl}`);

    const response = await fetch(
      `https://production-sfo.browserless.io/chromium/bql?token=${token}`,
      requestOptions
    );

    if (!response.ok) {
      throw new Error(`Browserless API returned status ${response.status}: ${await response.text()}`);
    }

    const result = await response.json() as Record<string, any>;
    console.log(`📦 [DHL] Received response from browserless.io`);

    // Check for GraphQL errors
    if (result.errors && result.errors.length > 0) {
      console.error(`❌ [DHL] GraphQL errors:`, result.errors);
      throw new Error(`GraphQL error: ${result.errors.map((e: any) => e.message).join(', ')}`);
    }

    if (!result.data) {
      console.error(`❌ [DHL] No data in response`);
      throw new Error('No data in Browserless response');
    }

    if (!result.data.screenshot?.base64) {
      console.error(`❌ [DHL] No screenshot data in response`, result.data);
      throw new Error('No screenshot data in response');
    }

    const screenshotBuffer = Buffer.from(result.data.screenshot.base64, 'base64');
    console.log(`✅ [DHL] Screenshot completed successfully, size: ${screenshotBuffer.length} bytes`);

    const trackingStatusText = result.data?.trackingStatusText?.text || '';
    console.log(`📊 [DHL] Tracking status text: ${trackingStatusText}`);

    let status = 'UNKNOWN';
    const upperStatus = trackingStatusText.toUpperCase();

    if (upperStatus.includes('DELIVERY SUCCESSFUL')) {
      status = 'DELIVERED';
    }

    return {
      status,
      buffer: screenshotBuffer
    };
  } catch (error) {
    console.error(`💥 [DHL] Error in dhlTrackingShipment:`, error);
    throw error;
  }
}
