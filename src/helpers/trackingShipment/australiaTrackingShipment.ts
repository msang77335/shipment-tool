import { getNextBrowserlessToken } from '..';

export async function australiaPostTrackingShipment(codes: string): Promise<{ status: string; buffer: Buffer }> {
  console.log(`📍 [AUSTRALIA POST] Starting screenshot for tracking: ${codes}`);

  const token = getNextBrowserlessToken();
  if (!token) {
    throw new Error('No Browserless API token available');
  }

  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");

  const graphql = JSON.stringify({
    query: `mutation Screenshot($url: String!) { 
      viewport(width: 1280, height: 1440, deviceScaleFactor: 1) { width height deviceScaleFactor }
      goto(url: $url, waitUntil: load) { status } 
      solve { found solved time } 
      waitForTimeout(time: 15000) { time }
      trackingStatus: evaluate(content: """
        (() => {
          try {
            const trackingEl = document.querySelector('#tracking');
            if (!trackingEl?.shadowRoot) return 'UNKNOWN';
            const statusEl = trackingEl.shadowRoot.querySelector('[slot=status]');
            const text = statusEl?.innerText || '';
            return text.toLowerCase().includes('delivered') ? 'DELIVERED' : 'UNKNOWN';
          } catch (e) {
            return 'UNKNOWN';
          }
        })()
      """) { value }
      screenshot(type: jpeg) { base64 } 
    }`,
    variables: { "url": `https://www.aftership.com/track/australia-post/${codes}` }
  });

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: graphql
  };

  try {
    console.log(`🌐 [AUSTRALIA POST] Calling browserless.io API...`);
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
          value?: string;
        }
      };
    };
    console.log(`📦 [AUSTRALIA POST] Received response from browserless.io`);

    if (!result.data?.screenshot?.base64) {
      throw new Error('No screenshot data in response');
    }

    const screenshotBuffer = Buffer.from(result.data.screenshot.base64, 'base64');
    console.log(`✅ [AUSTRALIA POST] Screenshot completed successfully, size: ${screenshotBuffer.length} bytes`);

    const status = result.data?.trackingStatus?.value || 'UNKNOWN';

    console.log(`📦 [AUSTRALIA POST] Tracking status extracted: ${status}`);

    return {
      status,
      buffer: screenshotBuffer
    };
  } catch (error) {
    console.error(`💥 [AUSTRALIA POST] Error in australiaPostTrackingShipment:`, error);
    throw error;
  }
}