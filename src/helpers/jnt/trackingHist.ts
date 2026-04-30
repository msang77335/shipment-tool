import { jntTrackingHistDb, type PaginationParams, type PaginatedResult, type JNTTrackingHistEntry } from '../../database/jntTrackingHist';
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
   * Get a tracking history entry by ID
   */
  async getHistById(id: string): Promise<JNTTrackingHist | null> {
    await this.ensureInitialized();
    return await jntTrackingHistDb.getById(id) as JNTTrackingHist | null;
  }

  /**
   * Delete a tracking history entry by ID
   */
  async deleteHistById(id: string): Promise<boolean> {
    await this.ensureInitialized();
    return await jntTrackingHistDb.deleteById(id);
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
   * Clear history by bankAccountName
   */
  async clearHistByBankAccountName(bankAccountName: string): Promise<number> {
    await this.ensureInitialized();
    return await jntTrackingHistDb.clearHistByBankAccountName(bankAccountName);
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

  /**
   * Process all tracking history entries
   * - Removes if status is 'processed'
   * - Checks if phone exists in database and attempts tracking if phones available
   * - Removes if tracking succeeds with existing phones
   * - Returns summary of all processed entries
   */
  async processAllTrackingEntries(): Promise<{
    success: boolean;
    totalProcessed: number;
    removed: number;
    tracked: number;
    incomplete: number;
    failed: number;
    notFound: number;
    message: string;
  }> {
    try {
      await this.ensureInitialized();

      // Get all tracking history entries
      const result = await jntTrackingHistDb.getAllHist({ limit: 1000 });
      const entries = result.data;

      if (entries.length === 0) {
        return this.getEmptyProcessingSummary();
      }

      const stats = {
        removed: 0,
        tracked: 0,
        incomplete: 0,
        failed: 0,
        notFound: 0
      };

      console.log(`⏰ [TRACKING HIST] Processing ${entries.length} entries...`);

      // Process all entries in parallel for better performance
      for (const entry of entries) {
        await this.processSingleEntry(entry, stats)

        await new Promise(resolve => setTimeout(resolve, 30000)); // Add a delay between processing each entry to avoid overwhelming the system and to allow for any asynchronous updates to the database to be reflected in subsequent iterations
      }

      return this.buildProcessingSummary(entries.length, stats);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ [TRACKING HIST] Error processing entries:`, error);
      return {
        success: false,
        totalProcessed: 0,
        removed: 0,
        tracked: 0,
        incomplete: 0,
        failed: 0,
        notFound: 0,
        message: `Failed to process entries: ${errorMsg}`
      };
    }
  }

  /**
   * Process a single tracking history entry
   */
  private async processSingleEntry(
    entry: JNTTrackingHistEntry,
    stats: any
  ): Promise<void> {
    try {
      // If status is 'processed', remove it immediately
      if (entry.status === 'processed') {
        await this.removeProcessedEntry(entry, stats);
        return;
      }

      // Check if phone exists in jnt phone database
      const existingPhones = await phoneManager.getPhonesByName(entry.bankAccountName);
      const phoneExists = existingPhones && existingPhones.length > 0;

      if (!phoneExists) {
        stats.notFound++;
        return;
      }

      // Attempt tracking with existing phones
      await this.attemptTracking(entry, existingPhones, stats);
    } catch (entryError) {
      console.error(`❌ [TRACKING HIST] Error processing entry ${entry.id}:`, entryError);
    }
  }

  /**
   * Remove a processed entry
   */
  private async removeProcessedEntry(entry: JNTTrackingHistEntry, stats: any): Promise<void> {
    const deleted = await jntTrackingHistDb.deleteById(entry.id!);
    if (deleted) {
      stats.removed++;
      console.log(`✅ [TRACKING HIST] Removed processed entry: ${entry.id}`);
    }
  }

  /**
   * Attempt tracking with existing phones
   */
  private async attemptTracking(
    entry: JNTTrackingHistEntry,
    existingPhones: string[],
    stats: any
  ): Promise<void> {
    try {
      const trackingResults = await trackWithPhones(existingPhones, entry.codes);

      // If tracking succeeded with multiple results, remove the entry
      if (trackingResults.length > 1) {
        const deleted = await jntTrackingHistDb.deleteById(entry.id!);
        if (deleted) {
          stats.tracked++;
          console.log(`✅ [TRACKING HIST] Removed entry after successful tracking: ${entry.id}`);
        }
      } else {
        stats.incomplete++;
        console.log(`⚠️  [TRACKING HIST] Entry ${entry.id} - tracking incomplete (${trackingResults.length} result(s))`);
      }
    } catch (trackError) {
      stats.failed++;
      console.warn(`⚠️  [TRACKING HIST] Entry ${entry.id} - tracking failed:`, trackError);
    }
  }

  /**
   * Build processing summary
   */
  private buildProcessingSummary(totalProcessed: number, stats: any) {
    const summary = {
      success: true,
      totalProcessed,
      removed: stats.removed,
      tracked: stats.tracked,
      incomplete: stats.incomplete,
      failed: stats.failed,
      notFound: stats.notFound,
      message: `Processed ${totalProcessed} entries: ${stats.removed} removed, ${stats.tracked} tracked, ${stats.incomplete} incomplete, ${stats.failed} failed, ${stats.notFound} phones not found`
    };
    return summary;
  }

  /**
   * Get empty processing summary
   */
  private getEmptyProcessingSummary() {
    return {
      success: true,
      totalProcessed: 0,
      removed: 0,
      tracked: 0,
      incomplete: 0,
      failed: 0,
      notFound: 0,
      message: 'No tracking history entries found'
    };
  }
}

export const trackingHistManager = new JNTTrackingHistManager();