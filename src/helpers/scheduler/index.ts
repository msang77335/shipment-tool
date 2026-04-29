/**
 * Scheduler - Handles periodic background tasks using node-cron
 * - Auto-replace blacklisted proxies every 5 minutes
 */

import cron, { ScheduledTask } from 'node-cron';
import { proxyManager } from '../proxy';
import { trackingHistManager } from '../jnt/trackingHist';
import { jntTrackingHistDb } from '../../database/jntTrackingHist';

class Scheduler {
  private replaceProxiesTask: ScheduledTask | null = null;
  private scanPhoneJobTask: ScheduledTask | null = null;
  private cleanupTask: ScheduledTask | null = null;
  private processOldestEntryTask: ScheduledTask | null = null;
  private isRunning: boolean = false;

  /**
   * Start all scheduled jobs
   */
  start(): void {
    if (this.isRunning) {
      console.log('⏰ [SCHEDULER] Already running');
      return;
    }

    this.isRunning = true;
    console.log('⏰ [SCHEDULER] Starting scheduled jobs...');

    // Schedule proxy replacement every 5 minutes
    this.scheduleProxyReplacement();

    // Schedule scan phone job resumption every 30 minutes
    this.scheduleScanPhoneJob();

    // Schedule cleanup of old tracking history every 24 hours
    this.scheduleCleanupOldTrackingHist();

    // Schedule process oldest tracking entry at minute 45 of every hour
    this.scheduleProcessOldestEntry();
  }

  // Schedule automatic proxy replacement from blacklist
  // Runs every 3 hours using cron pattern
  private scheduleProxyReplacement(): void {
    const CRON_PATTERN = '0 */3 * * *';

    console.log(`🔄 [SCHEDULER] Scheduling proxy replacement (${CRON_PATTERN})`);

    this.replaceProxiesTask = cron.schedule(CRON_PATTERN, () => {
      this.executeProxyReplacement();
    });

    console.log('✅ [SCHEDULER] Proxy replacement task scheduled');
  }

  /**
   * Execute proxy replacement job
   */
  private async executeProxyReplacement(): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      console.log(`⏰ [SCHEDULER] Executing proxy replacement job at ${timestamp}`);

      const result = await proxyManager.replaceProxiesAutomatic(2, false);

      if (result.success) {
        console.log(`✅ [SCHEDULER] Proxy replacement completed:`);
        console.log(`   - Removed proxies: ${result.removedProxies.length}`);
        console.log(`   - Reloaded count: ${result.reloadedCount}`);
        console.log(`   - Total proxies: ${result.totalProxies}`);
      } else {
        console.log(`⚠️  [SCHEDULER] Proxy replacement had no action: ${result.message}`);
      }
    } catch (error) {
      console.error(`❌ [SCHEDULER] Error during proxy replacement:`, error);
    }
  }

  /**
   * Schedule scan phone job form JNT history tracking
   * Runs every 30 minutes using cron pattern
   */
  private scheduleScanPhoneJob(): void {
    const CRON_PATTERN = '*/30 * * * *'; // Every 30 minutes

    console.log(`🔄 [SCHEDULER] Scheduling scan phone job resumption (${CRON_PATTERN})`);

    this.replaceProxiesTask = cron.schedule(CRON_PATTERN, () => {
      this.executeScanPhoneJobResumption();
    });

    console.log('✅ [SCHEDULER] Scan phone job resumption task scheduled');
  }

  /**
   * Execute scan phone job resumption
   * - Finds paused or stuck jobs and attempts to resume them
   * - Runs every 30 minutes to ensure jobs are not left hanging indefinitely
   */
  private async executeScanPhoneJobResumption(): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      console.log(`⏰ [SCHEDULER] Executing scan phone job resumption at ${timestamp}`);

      // Get jobs to resume (paused or stuck)
      await trackingHistManager.scanPhoneFromList();

    } catch (error) {
      console.error(`❌ [SCHEDULER] Error during scan phone job resumption:`, error);
    }
  }

  /**
   * Schedule cleanup of old tracking history
   * Runs every 24 hours at 3 AM using cron pattern
   * Deletes all entries older than 25 days
   */
  private scheduleCleanupOldTrackingHist(): void {
    const CRON_PATTERN = '0 3 * * *'; // Every day at 3 AM

    console.log(`🔄 [SCHEDULER] Scheduling cleanup of old tracking history (${CRON_PATTERN})`);

    this.cleanupTask = cron.schedule(CRON_PATTERN, () => {
      this.executeCleanupOldTrackingHist();
    });

    console.log('✅ [SCHEDULER] Cleanup old tracking history task scheduled');
  }

  /**
   * Execute cleanup of old tracking history
   * Deletes all entries older than 25 days from jnt_tracking_hist
   */
  private async executeCleanupOldTrackingHist(): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      console.log(`⏰ [SCHEDULER] Executing cleanup of old tracking history at ${timestamp}`);

      const deletedCount = await jntTrackingHistDb.cleanupOlderThan25Days();

      console.log(`✅ [SCHEDULER] Cleanup completed: Deleted ${deletedCount} entries older than 25 days`);
    } catch (error) {
      console.error(`❌ [SCHEDULER] Error during cleanup of old tracking history:`, error);
    }
  }

  /**
   * Schedule process oldest tracking entry
   * Runs every hour at minute 45 using cron pattern
   * Processes the oldest tracking history entry
   */
  private scheduleProcessOldestEntry(): void {
    const CRON_PATTERN = '45 * * * *'; // Every hour at minute 45

    console.log(`🔄 [SCHEDULER] Scheduling process oldest tracking entry (${CRON_PATTERN})`);

    this.processOldestEntryTask = cron.schedule(CRON_PATTERN, () => {
      this.executeProcessOldestEntry();
    });

    console.log('✅ [SCHEDULER] Process oldest tracking entry task scheduled');
  }

  /**
   * Execute process oldest tracking entry
   * - Gets the oldest tracking history entry
   * - Removes if already processed or successfully tracked with existing phones
   * - Returns entry details if no removal occurs
   */
  private async executeProcessOldestEntry(): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      console.log(`⏰ [SCHEDULER] Executing process oldest tracking entry at ${timestamp}`);

      await trackingHistManager.clearHistByStatus('processed');

      const result = await trackingHistManager.processAllTrackingEntries();

      if (result.success) {
        console.log(`✅ [SCHEDULER] Process oldest tracking entry completed:`);
      } else {
        console.error(`❌ [SCHEDULER] Failed to process oldest entry: ${result.message}`);
      }
    } catch (error) {
      console.error(`❌ [SCHEDULER] Error during process oldest tracking entry:`, error);
    }
  }
}

// Singleton instance
export const scheduler = new Scheduler();
