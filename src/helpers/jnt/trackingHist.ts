import { randomUUID } from 'node:crypto';

export interface JNTTrackingHist {
  id: string;
  codes: string;
  bankAccountName: string;
  site: "J&T" | "AfterShip";
}

class JNTTrackingHistManager {
  private trackingHist: JNTTrackingHist[] = [];

  /**
   * Get all current tracking history
   */
  getAllHist({ site }: { site?: "J&T" | "AfterShip" }): JNTTrackingHist[] {
    if (site) {
      return this.trackingHist.filter(hist => hist.site === site);
    }
    return this.trackingHist;
  }

  /**
   * Add a tracking history record
   */
  addHist(codes: string, bankAccountName: string, site: "J&T" | "AfterShip"): JNTTrackingHist {
    const hist: JNTTrackingHist = { 
      id: randomUUID(),
      codes,
      bankAccountName,
      site
    };

    this.trackingHist.push(hist);
    console.log(`✅ [JNT TRACKING HIST] Added tracking history: ${hist.id} for codes: ${codes}`);

    return hist;
  }

  /**
   * Clear all tracking history
   */
  clearHist(): void {
    this.trackingHist = [];
    console.log(`✅ [JNT TRACKING HIST] Cleared all tracking history`);
  }
}

export const trackingHistManager = new JNTTrackingHistManager();