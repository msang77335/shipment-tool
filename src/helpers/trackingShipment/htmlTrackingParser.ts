import * as cheerio from 'cheerio';

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
export const parseHtmlTrackingResponse = (htmlContent: string): ShipmentTracking[] => {
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
      events: events.reverse(), // Reverse to show chronological order (oldest to newest)
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
  const cleanText = text.replace(/<[^>]*>/g, '').trim();

  // Extract phone number (format: +84xxxxxxxxx)
  const phoneMatch = cleanText.match(/\+84\d{9,}/);
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
export const convertToStandardFormat = (shipments: ShipmentTracking[]) => {
  return shipments.map((shipment) => ({
    trackingNumber: shipment.trackingNumber,
    status: shipment.currentStatus,
    lastUpdated: shipment.lastUpdate,
    history: shipment.events,
  }));
};
