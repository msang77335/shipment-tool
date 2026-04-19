import { jntTrackingHistDb, type PaginationParams, type PaginatedResult } from '../../database/jntTrackingHist';

export interface JNTTrackingHist {
  id: string;
  codes: string;
  bankAccountName: string;
  site: "J&T" | "AfterShip";
  addedAt?: number;
}

class JNTTrackingHistManager {
  private initialized: boolean = false;

  /**
   * Initialize database on first use
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await jntTrackingHistDb.initialize();
      this.initialized = true;
    }
  }

  /**
   * Get tracking history with strict pagination (always returns paginated result)
   */
  async getHistPaginated(params: PaginationParams = {}): Promise<PaginatedResult<JNTTrackingHist>> {
    await this.ensureInitialized();
    return await jntTrackingHistDb.getAllHist(params) as PaginatedResult<JNTTrackingHist>;
  }

  /**
   * Get tracking history by site
   */
  async getHistBySite(site: "J&T" | "AfterShip", params: PaginationParams = {}): Promise<PaginatedResult<JNTTrackingHist>> {
    await this.ensureInitialized();
    return await jntTrackingHistDb.getHistBySite(site, params) as PaginatedResult<JNTTrackingHist>;
  }

  /**
   * Add a tracking history record
   */
  async addHist(codes: string, bankAccountName: string, site: "J&T" | "AfterShip"): Promise<JNTTrackingHist> {
    await this.ensureInitialized();
    const entry = await jntTrackingHistDb.addEntry(codes, bankAccountName, site);
    return entry as JNTTrackingHist;
  }

  /**
   * Clear all tracking history
   */
  async clearHist(): Promise<number> {
    await this.ensureInitialized();
    const count = await jntTrackingHistDb.clearHist();
    console.log(`✅ [JNT TRACKING HIST] Cleared ${count} tracking history entries`);
    return count;
  }

  /**
   * Clear history by date range (in milliseconds)
   */
  async clearHistByDateRange(startTime: number, endTime: number): Promise<number> {
    await this.ensureInitialized();
    return await jntTrackingHistDb.clearHistByDateRange(startTime, endTime);
  }
}

export const trackingHistManager = new JNTTrackingHistManager();