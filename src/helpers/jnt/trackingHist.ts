import { jntTrackingHistDb, type PaginationParams, type PaginatedResult } from '../../database/jntTrackingHist';
import { phoneManager } from './phone';
import { scanPhoneJobManager } from './scanPhoneJobManager';
import { trackWithPhones } from '../trackingShipment/jntTrackingShipment';

export interface JNTTrackingHist {
  id: string;
  codes: string;
  bankAccountName: string;
  site: "J&T" | "AfterShip";
  status?: 'pending' | 'processed' | 'failed';
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
   * Helper function to add tracking history entries
   */
  async addTrackingHistoryEntries(entries: any[]) {
    const validSites = ["J&T", "AfterShip"];
    const addedEntries: any[] = [];
    const errors: string[] = [];
  
    for (const entry of entries) {
      try {
        const { codes, bankAccountName, site } = entry;
  
        // Validate required fields
        if (!codes || typeof codes !== 'string' || codes.trim().length === 0) {
          errors.push('Missing or invalid "codes" field');
          continue;
        }
  
        if (!bankAccountName || typeof bankAccountName !== 'string' || bankAccountName.trim().length === 0) {
          errors.push('Missing or invalid "bankAccountName" field');
          continue;
        }
  
        if (!site || !validSites.includes(site)) {
          errors.push(`Invalid site. Expected: ${validSites.join(', ')}`);
          continue;
        }
  
        // Add the entry to tracking history
        const addedEntry = await this.addHist(codes, bankAccountName.replaceAll(/\s+/g, ''), site);
        addedEntries.push(addedEntry);
        console.log(`✅ [JNT TRACKING HIST ROUTE] Added entry: ${codes} for ${bankAccountName} (${site})`);
      } catch (entryError) {
        const errorMsg = entryError instanceof Error ? entryError.message : String(entryError);
        errors.push(`Failed to add entry: ${errorMsg}`);
        console.error(`❌ [JNT TRACKING HIST ROUTE] Error adding entry:`, entryError);
      }
    }
  
    return { addedEntries, errors };
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
   * Clear history by status
   */
  async clearHistByStatus(status: 'pending' | 'processed' | 'failed'): Promise<number> {
    await this.ensureInitialized();
    return await jntTrackingHistDb.clearHistByStatus(status);
  }

  /**
   * Clear history by date range (in milliseconds)
   */
  async clearHistByDateRange(startTime: number, endTime: number): Promise<number> {
    await this.ensureInitialized();
    return await jntTrackingHistDb.clearHistByDateRange(startTime, endTime);
  }

  /**
   * Scan phone numbers from JNT tracking history
   * Gets 1 item from history, finds it in phone pool, and creates a scan job
   * Returns job details or error info
   */
  async scanPhoneFromList(): Promise<{
    success: boolean;
    message: string;
    phones?: string[];
    jobId?: string;
    error?: string;
  }> {
    try {
      await this.ensureInitialized();

      const canCreateJob = await scanPhoneJobManager.canCreateNewJob();
      if (!canCreateJob) {
        return {
          success: false,
          message: 'A scan job is already in progress. Please wait for it to complete before scanning from history.',
          error: 'Job limit reached'
        }
      }

      const histReadyForScan = await jntTrackingHistDb.getHistReadyForPhoneScan();

      if (!histReadyForScan) {
        return {
          success: false,
          message: 'No tracking history found',
          error: 'Empty history'
        };
      }

      console.log(`📋 [TRACKING HIST] Found history item: ${histReadyForScan.codes} (${histReadyForScan.bankAccountName})`);

      // Find phones in the pool by account name
      const phones = await phoneManager.getPhonesByName(histReadyForScan.bankAccountName);

      if (phones?.length) {
        const dedupedResults = await trackWithPhones(phones, histReadyForScan.codes);

        // If we got multiple results, it means we successfully tracked with multiple phones, so we can add all phones to the pool under the bank account name for future use
        if (dedupedResults.length > 1) {
          // Mark history as processed since we successfully tracked
          await jntTrackingHistDb.markAsProcessed(histReadyForScan.id!);
          console.log(`✅ [TRACKING HIST] Successfully tracked for account: ${histReadyForScan.bankAccountName} with phones: ${phones.join(', ')}`);
          return {
            success: true,
            message: `Successfully tracked for account: ${histReadyForScan.bankAccountName} with phones: ${phones.join(', ')}`,
            phones,
          }
        }
      }

      const trackingCode = histReadyForScan.codes.split(',')[0].trim();

      if (!trackingCode) {
        return {
          success: false,
          message: 'No valid tracking code found in history item',
          error: 'Invalid tracking code'
        };
      }

      console.log(`⚠️  [TRACKING HIST] No phones found for account: ${histReadyForScan.bankAccountName}. Creating scan job for tracking code: ${trackingCode}`);
      const createJobResult = await scanPhoneJobManager.createJob(trackingCode);
      if (!createJobResult.success || !createJobResult.job) {
        return {
          success: false,
          message: createJobResult.message || 'Failed to create scan job',
          error: createJobResult.error || 'Unknown error'
        }
      }

      const job = createJobResult.job;
      await scanPhoneJobManager.createScanJobRef(job.id, histReadyForScan.id!);
      console.log(`✅ [TRACKING HIST] Created scan job with ID: ${job.id} for account: ${histReadyForScan.bankAccountName} and tracking code: ${trackingCode}`);
      scanPhoneJobManager.runJobInBackground(job.id);

      return {
        success: true,
        message: `No phones found for account: ${histReadyForScan.bankAccountName}. Created scan job with ID: ${job.id}`,
        jobId: job.id
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ [TRACKING HIST] Error scanning from history:`, error);
      return {
        success: false,
        message: 'Failed to scan from history',
        error: errorMsg
      };
    }
  }
}

export const trackingHistManager = new JNTTrackingHistManager();