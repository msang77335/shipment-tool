/**
 * Scheduler - Handles periodic background tasks using node-cron
 * - Auto-replace blacklisted proxies every 5 minutes
 */

import cron, { ScheduledTask } from 'node-cron';
import { proxyManager } from '../proxy';
import { trackingHistManager } from '../jnt/trackingHist';
import { jntTrackingHistDb } from '../../database/jntTrackingHist';
import { PlaywrightBrowserSingleton } from '../browser/PlaywrightBrowserSingleton';
import { phoneManager } from '../jnt/phone';
import { env } from '../env';
import axios from 'axios';

class Scheduler {
  private replaceProxiesTask: ScheduledTask | null = null;
  private scanPhoneJobTask: ScheduledTask | null = null;
  private cleanupTask: ScheduledTask | null = null;
  private processOldestEntryTask: ScheduledTask | null = null;
  private reloadProxiesFromWebshareTask: ScheduledTask | null = null;
  private exportPhonesToTelegramTask: ScheduledTask | null = null;
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

    // Schedule reload proxies from webshare at 2 AM Vietnam time
    this.scheduleReloadProxiesFromWebshare();

    // Schedule export phones to telegram at 3 AM Vietnam time
    this.scheduleExportPhonesToTelegram();
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

  /**
   * Schedule reload proxies from webshare
   * Runs every day at 2 AM Vietnam time (UTC+7) using cron pattern
   */
  private scheduleReloadProxiesFromWebshare(): void {
    const CRON_PATTERN = '0 2 * * *'; // 2 AM Vietnam time

    console.log(`🔄 [SCHEDULER] Scheduling reload proxies from webshare (${CRON_PATTERN})`);

    this.reloadProxiesFromWebshareTask = cron.schedule(CRON_PATTERN, () => {
      this.executeReloadProxiesFromWebshare();
    }, {
      timezone: 'Asia/Ho_Chi_Minh' // Vietnam timezone (UTC+7)
    });

    console.log('✅ [SCHEDULER] Reload proxies from webshare task scheduled');
  }

  /**
   * Execute reload proxies from webshare
   * Fetches and reloads all proxies from webshare API
   */
  private async executeReloadProxiesFromWebshare(): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      console.log(`⏰ [SCHEDULER] Executing reload proxies from webshare at ${timestamp}`);

      // Close all browser contexts using proxies before reloading
      console.log(`🔌 [SCHEDULER] Closing all browser contexts using proxies`);
      await PlaywrightBrowserSingleton.closeAllContexts();

      await proxyManager.initializeWebshare();

      console.log(`✅ [SCHEDULER] Reload proxies from webshare completed`);
    } catch (error) {
      console.error(`❌ [SCHEDULER] Error during reload proxies from webshare:`, error);
    }
  }

  /**
   * Schedule export phones to telegram
   * Runs every day at 3 AM Vietnam time (UTC+7) using cron pattern
   */
  private scheduleExportPhonesToTelegram(): void {
    const CRON_PATTERN = '0 3 * * *'; // 3 AM Vietnam time

    console.log(`🔄 [SCHEDULER] Scheduling export phones to telegram (${CRON_PATTERN})`);

    this.exportPhonesToTelegramTask = cron.schedule(CRON_PATTERN, () => {
      this.executeExportPhonesToTelegram();
    }, {
      timezone: 'Asia/Ho_Chi_Minh' // Vietnam timezone (UTC+7)
    });

    console.log('✅ [SCHEDULER] Export phones to telegram task scheduled');
  }

  /**
   * Execute export phones to telegram
   * Exports all phones from phone manager and sends to Telegram as CSV file
   */
  private async executeExportPhonesToTelegram(): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      console.log(`⏰ [SCHEDULER] Executing export phones to telegram at ${timestamp}`);

      const rows = await phoneManager.exportPhones();

      if (rows.length === 0) {
        console.log(`⚠️  [SCHEDULER] No phones to export`);
        return;
      }

      // Generate CSV content
      let csvContent = 'Seller,Phone 1,Phone 2,Phone 3,Phone 4,Phone 5\n';
      for (const row of rows) {
        const escapedRow = row.map(cell => {
          // Escape quotes and wrap in quotes if contains comma
          const escaped = String(cell).replaceAll('"', '""');
          return escaped.includes(',') ? `"${escaped}"` : escaped;
        });
        csvContent += escapedRow.join(',') + '\n';
      }

      const csvBuffer = Buffer.from(csvContent, 'utf-8');
      const fileName = `jnt_phones_${new Date().toISOString().split('T')[0]}.csv`;

      // Send to Telegram
      const botToken = env.telegramBotToken;
      const chatId = env.telegramChatId;

      if (!botToken || !chatId) {
        console.warn(`⚠️  [SCHEDULER] Telegram credentials not configured (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing)`);
        console.log(`✅ [SCHEDULER] Phone export completed: ${rows.length} sellers with ${rows.reduce((sum, row) => sum + row.length - 1, 0)} phones`);
        return;
      }

      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendDocument`;
      
      // Create FormData to send file
      const FormData = require('form-data');
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('document', csvBuffer, fileName);
      form.append('caption', `📱 *JNT Phone Pool Export*\n\nTotal sellers: ${rows.length}\nDate: ${new Date().toLocaleString('vi-VN')}`);
      form.append('parse_mode', 'Markdown');

      const response = await axios.post(telegramUrl, form, {
        headers: form.getHeaders(),
        timeout: 10000
      });

      if (response.data.ok) {
        console.log(`✅ [SCHEDULER] Phone export CSV sent to Telegram (${rows.length} sellers, ${rows.reduce((sum, row) => sum + row.length - 1, 0)} phones)`);
      } else {
        console.error(`❌ [SCHEDULER] Telegram send failed:`, response.data);
      }
    } catch (error) {
      console.error(`❌ [SCHEDULER] Error during export phones to telegram:`, error);
    }
  }
}

// Singleton instance
export const scheduler = new Scheduler();
