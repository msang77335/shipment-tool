/**
 * Scheduler - Handles periodic background tasks using node-cron
 * - Auto-replace blacklisted proxies every 5 minutes
 */

import cron, { ScheduledTask } from 'node-cron';
import { proxyManager } from '../proxy';
import { trackingHistManager } from '../jnt/trackingHist';

class Scheduler {
  private replaceProxiesTask: ScheduledTask | null = null;
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
    };
  }
}

// Singleton instance
export const scheduler = new Scheduler();
