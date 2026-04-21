/**
 * Job Manager - Manages background scan phone jobs
 * Stores results in SQLite database
 */

import EventEmitter from 'node:events';
import { jntTrackingHistDb, JNTTrackingHistEntry } from '../../database/jntTrackingHist';
import { scanPhoneJobsDb, type ScanPhoneJobEntry } from '../../database/scanPhoneJobs';
import { scanPhoneJobRefDb } from '../../database/scanPhoneJobs/scanPhoneJobRefDb';
import { trackWithPhones } from '../trackingShipment/jntTrackingShipment';
import { phoneManager } from './phone';
import { PhoneBruteForceFinder } from './scanPhone';

type JobStatus = 'pending' | 'processing' | 'paused' | 'success' | 'error';

export const SCAN_PHONE_JOB_EVENT = {
  JOB_STARTED: 'jobStarted',
  JOB_RESUMED: 'jobResumed',
  UPDATE_ATTEMPT: 'updateAttempt',
  JOB_COMPLETED: 'jobCompleted'
}

export interface ScanPhoneJob {
  id: string;
  codes: string;
  status: JobStatus;
  result?: {
    status: string;
    billcode: string;
    validPhones: string;
    attemptCount?: number;
  };
  error?: string;
  attemptCount?: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

class ScanPhoneJobManager extends EventEmitter {
  private initialized: boolean = false;
  private activeJobSignals: Map<string, AbortController> = new Map();

  /**
   * Initialize database on first use
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await scanPhoneJobsDb.initialize();
      this.initialized = true;
    }
  }

  /**
   * Create and store abort signal for a job
   */
  createAbortSignal(jobId: string): AbortSignal {
    const controller = new AbortController();
    this.activeJobSignals.set(jobId, controller);
    return controller.signal;
  }

  /**
   * Abort a running job by stopping its signal
   */
  abortJob(jobId: string): void {
    const controller = this.activeJobSignals.get(jobId);
    if (controller) {
      controller.abort();
      console.log(`🛑 [JOB MANAGER] Abort signal sent to job ${jobId}`);
    }
  }

  /**
   * Clean up signal when job completes
   */
  cleanupSignal(jobId: string): void {
    this.activeJobSignals.delete(jobId);
  }

  /**
   * Check if a new job can be created (no pending/processing/paused jobs)
   */
  async canCreateNewJob(): Promise<boolean> {
    await this.ensureInitialized();

    return scanPhoneJobsDb.canCreateNewJob();
  }

  /**
   * Create a new scan phone job
   */
  async createJob(codes: string, attemptCount: number = 0): Promise<{ success: boolean; message: string; job?: ScanPhoneJob; error?: string }> {
    await this.ensureInitialized();
    const canCreateNewJob = await scanPhoneJobsDb.canCreateNewJob();
    if (!canCreateNewJob) {
      return {
        success: false,
        message: 'A job is already in progress. Please wait for it to complete before creating a new one.',
        error: 'Job limit reached'
      }
    }
    const entry = await scanPhoneJobsDb.createJob(codes, attemptCount);

    return {
      success: true,
      message: 'Job created successfully',
      job: {
        id: entry.id!,
        codes: entry.codes,
        status: entry.status as JobStatus,
        attemptCount: entry.attemptCount,
        createdAt: entry.createdAt!
      }
    };
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<ScanPhoneJob | null> {
    await this.ensureInitialized();
    const entry = await scanPhoneJobsDb.getJob(jobId);

    if (!entry) {
      console.warn(`⚠️ [SCAN JOBS] Job ${jobId} not found`);
      return null;
    }

    return {
      id: entry.id!,
      codes: entry.codes,
      status: entry.status as JobStatus,
      result: entry.result ? JSON.parse(entry.result) : undefined,
      error: entry.error,
      attemptCount: entry.attemptCount,
      createdAt: entry.createdAt!,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt
    };
  }

  /**
   * Update job status to processing
   */
  async setProcessing(jobId: string): Promise<void> {
    await this.ensureInitialized();
    await scanPhoneJobsDb.setProcessing(jobId);
  }

  /**
   * Mark job as completed with result
   */
  async setSuccess(jobId: string, result: ScanPhoneJob['result'], attemptCount?: number): Promise<void> {
    await this.ensureInitialized();
    await scanPhoneJobsDb.setSuccess(jobId, result, attemptCount);
  }

  /**
   * Mark job as failed with error
   */
  async setError(jobId: string, error: string): Promise<void> {
    await this.ensureInitialized();
    await scanPhoneJobsDb.setError(jobId, error);
  }

  /**
   * Update job progress (attempt count) in real-time during brute force
   */
  async updateProgress(jobId: string, attemptCount: number): Promise<void> {
    await this.ensureInitialized();
    await scanPhoneJobsDb.updateProgress(jobId, attemptCount);
  }

  /**
   * Start background job processing (emits event)
   */
  async runJobInBackground(jobId: string): Promise<void> {
    const job = await this.getJob(jobId) as ScanPhoneJob;
    if (!job) {
      console.error(`❌ [JNT] Job ${jobId} not found for background processing`);
      return;
    }

    console.log(`📤 [JNT] Emitting JOB_STARTED event for job ${jobId}`);
    this.emit(SCAN_PHONE_JOB_EVENT.JOB_STARTED, jobId);
  }

  /**
   * Pause a processing job (actually stops the background process)
   */
  async pauseJob(jobId: string): Promise<void> {
    // Signal the background job to stop
    this.abortJob(jobId);

    // Update DB status to paused
    await this.ensureInitialized();
    await scanPhoneJobsDb.pauseJob(jobId);
  }

  /**
   * Resume a paused job in background (emits event)
   */
  async resumeJobInBackground(jobId: string): Promise<void> {
    const job = await this.getJob(jobId) as ScanPhoneJob;
    if (!job) {
      console.error(`❌ [JNT] Job ${jobId} not found for background resume`);
      return;
    }

    console.log(`📤 [JNT] Emitting JOB_RESUMED event for job ${jobId}`);
    this.emit(SCAN_PHONE_JOB_EVENT.JOB_RESUMED, jobId);
  }

  /**
   * Resume a paused job
   */
  async resumeJob(jobId: string): Promise<void> {
    await this.ensureInitialized();
    await scanPhoneJobsDb.resumeJob(jobId);
  }

  /**
   * List all jobs with optional status filter
   */
  async listJobs(limit: number = 100, status?: JobStatus): Promise<ScanPhoneJob[]> {
    await this.ensureInitialized();
    const entries = await scanPhoneJobsDb.listJobs({ limit, status });

    return entries.map((entry: ScanPhoneJobEntry) => ({
      id: entry.id!,
      codes: entry.codes,
      status: entry.status as JobStatus,
      result: entry.result ? JSON.parse(entry.result) : undefined,
      error: entry.error,
      attemptCount: entry.attemptCount,
      createdAt: entry.createdAt!,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt
    }));
  }

  /**
   * Delete a job by ID
   */
  async deleteJob(jobId: string): Promise<boolean> {
    await this.ensureInitialized();
    return await scanPhoneJobsDb.deleteJob(jobId);
  }

  /**
   * Start background resume processing for a single job (emits event)
   * @private
   */
  private async startBackgroundResume(job: ScanPhoneJob): Promise<void> {
    console.log(`📤 [AUTO RESUME] Emitting JOB_RESUMED event for job ${job.id}`);
    this.emit(SCAN_PHONE_JOB_EVENT.JOB_RESUMED, job.id);
  }

  /**
   * Get jobs to resume (paused jobs or stuck processing jobs)
   * @private
   */
  private async getJobsToResume(): Promise<ScanPhoneJob[]> {
    const pausedJobs = await this.listJobs(1000, 'paused');
    if (pausedJobs.length > 0) return pausedJobs;

    const processingJobs = await this.listJobs(1000, 'processing');
    if (processingJobs.length === 0) return [];

    console.log(`🔍 [AUTO RESUME] No paused jobs, found ${processingJobs.length} stuck processing job(s)`);
    console.log(`⏸️ [AUTO RESUME] Pausing stuck jobs first...`);

    for (const job of processingJobs) {
      try {
        await scanPhoneJobsDb.pauseJob(job.id);
        console.log(`⏸️ [AUTO RESUME] Paused stuck job: ${job.id}`);
      } catch (error) {
        console.error(`❌ [AUTO RESUME] Failed to pause job ${job.id}:`, error);
      }
    }

    return processingJobs;
  }

  /**
   * Find and auto-resume all paused jobs (called on service startup)
   * If no paused jobs, finds and recovers stuck processing jobs
   * Returns info about resumed jobs
   */
  async autoResumePausedJobs(): Promise<{
    total: number;
    resumed: string[];
    errors: { jobId: string; error: string }[];
  }> {
    try {
      await this.ensureInitialized();

      const jobsToResume = await this.getJobsToResume();

      if (jobsToResume.length === 0) {
        console.log(`✅ [AUTO RESUME] No paused or processing jobs found`);
        return { total: 0, resumed: [], errors: [] };
      }

      console.log(`🔍 [AUTO RESUME] Found ${jobsToResume.length} job(s) to resume...`);

      const resumed: string[] = [];
      const errors: { jobId: string; error: string }[] = [];

      for (const job of jobsToResume) {
        try {
          await this.resumeJob(job.id);
          await this.startBackgroundResume(job);

          resumed.push(job.id);
          console.log(`▶️ [AUTO RESUME] Resumed job: ${job.id} (codes: ${job.codes}, attemptCount: ${job.attemptCount})`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push({ jobId: job.id, error: errorMsg });
          console.error(`❌ [AUTO RESUME] Failed to resume job ${job.id}:`, error);
        }
      }

      return { total: jobsToResume.length, resumed, errors };
    } catch (error) {
      console.error(`❌ [AUTO RESUME] Error during auto-resume:`, error);
      return { total: 0, resumed: [], errors: [{ jobId: 'unknown', error: String(error) }] };
    }
  }

  async createScanJobRef(scanPhoneJobId: string, jntTrackingHistId: string) {
    await this.ensureInitialized();
    return await scanPhoneJobRefDb.addEntry(scanPhoneJobId, jntTrackingHistId);
  }

  /**
   * Extract unique phones from all groups
   * @private
   */
  private async getPhonePoolList(): Promise<string[]> {
    const allPhones = await phoneManager.getAllPhones();
    const phoneSet = new Set<string>();
    allPhones.forEach(group => group.phones.forEach(phone => phoneSet.add(phone)));
    return Array.from(phoneSet);
  }

  /**
   * Handle job execution errors
   * @private
   */
  private async handleExecutionError(jobId: string, error: unknown): Promise<void> {
    if (error instanceof Error && error.message === 'JOB_ABORTED') {
      console.log(`✅ [EVENT] Job ${jobId} paused by user`);
      return;
    }
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ [EVENT] Error in job ${jobId}:`, error);
    console.error(`📝 [EVENT] Error details:`, { message: errorMsg, stack: error instanceof Error ? error.stack : 'N/A' });
    await this.setError(jobId, errorMsg);
  }

  /**
   * Handle job execution logic (shared by JOB_STARTED and JOB_RESUMED)
   * @private
   */
  private async handleJobExecution(jobId: string, isResume: boolean = false): Promise<void> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        console.error(`❌ [EVENT] Job ${jobId} not found`);
        return;
      }

      // Set processing status only if not resuming (already paused)
      if (isResume) {
        console.log(`⚙️ [EVENT] Job ${jobId} status already set to paused, resuming...`);
      } else {
        await scanPhoneJobsDb.setProcessing(jobId);
        console.log(`⚙️ [EVENT] Job ${jobId} status set to processing`);
      }

      // Create abort signal for this job
      const abortSignal = this.createAbortSignal(jobId);

      // Get all phones from the pool
      const phoneList = await this.getPhonePoolList();
      if (phoneList.length === 0) {
        await this.setError(jobId, 'No phones available in pool');
        this.cleanupSignal(jobId);
        return;
      }

      const finder = new PhoneBruteForceFinder(Number.parseInt(job.attemptCount?.toString() || '0') || 0, abortSignal);

      // Calculate start position
      const startFrom = Math.max(0, (job.attemptCount || 0));
      const logPrefix = isResume ? 'Resuming' : 'Starting';
      console.log(`⏳ [EVENT] ${logPrefix} phone find for job ${jobId}, startFrom: ${startFrom}`);

      // Run the scan
      const result = await finder.findPhone({ billcode: job.codes, phones: phoneList, startFrom, jobId });
      const logSuffix = isResume ? 'resumed and completed' : 'completed';
      console.log(`✅ [EVENT] Phone find ${logSuffix} for job ${jobId}. Result:`, JSON.stringify(result));

      // Save result with attemptCount
      console.log(`💾 [EVENT] Calling setSuccess for job ${jobId} with attemptCount: ${result.attemptCount}`);
      await this.setSuccess(jobId, result, result.attemptCount);
      console.log(`✅ [EVENT] setSuccess completed for job ${jobId}`);

      // Emit job completed event
      this.emit(SCAN_PHONE_JOB_EVENT.JOB_COMPLETED, jobId, result);
    } catch (error) {
      await this.handleExecutionError(jobId, error);
    } finally {
      this.cleanupSignal(jobId);
    }
  }

  private async evaluatePhoneValidity(trackingHist: JNTTrackingHistEntry, attemptCount: number): Promise<boolean> {
    const dedupedResults = await trackWithPhones([String(attemptCount)], trackingHist.codes);
    return dedupedResults.length > 1; // If more than 1 result, it means the phone is valid (found in pool)
  }

  setupEventListeners() {
    this.on(SCAN_PHONE_JOB_EVENT.JOB_STARTED, async (jobId: string) => {
      console.log(`🚀 [EVENT] Job ${jobId} started`);

      // Start background processing (don't await)
      (async () => {
        await this.handleJobExecution(jobId, false);
      })();
    });

    this.on(SCAN_PHONE_JOB_EVENT.JOB_RESUMED, async (jobId: string) => {
      console.log(`▶️ [EVENT] Job ${jobId} resumed`);

      // Start background processing (don't await)
      (async () => {
        await this.handleJobExecution(jobId, true);
      })();
    });

    this.on(SCAN_PHONE_JOB_EVENT.UPDATE_ATTEMPT, (jobId: string, attemptCount: number) => {
      scanPhoneJobsDb.updateAttemptCount(jobId, attemptCount).catch(err => {
        console.error(`❌ [EVENT] Failed to update attempt count for job ${jobId}:`, err);
      });
    });

    this.on(SCAN_PHONE_JOB_EVENT.JOB_COMPLETED, async (jobId: string, result: { validPhones: string, billcode: string }) => {
      console.log(`🎉 [EVENT] Job ${jobId} completed with result:`, result);

      const attemptCount = Number.parseInt(result.validPhones) || 0;

      if (attemptCount === 0) {
        console.log(`⚠️ [EVENT] Job ${jobId} found no valid phones, skipping post-processing`);
        return;
      }

      // Mark associated tracking history as processed
      try {
        const ref = await scanPhoneJobRefDb.getByScanPhoneJobId(jobId);

        if (!ref) {
          console.warn(`⚠️ [EVENT] No tracking history reference found for job ${jobId}`);
          return;
        }

        const trackingHist = await jntTrackingHistDb.getById(ref.jntTrackingHistId);
        if (!trackingHist) {
          console.warn(`⚠️ [EVENT] No tracking history found for reference ${ref.id} and job ${jobId}`);
          return;
        }

        // Evaluate phone validity before marking as processed
        const isValid = await this.evaluatePhoneValidity(trackingHist, attemptCount || 0);

        if (isValid) {
          await phoneManager.addPhone(String(attemptCount).padStart(4, '0'), trackingHist.bankAccountName);
          await jntTrackingHistDb.markAsProcessed(ref.jntTrackingHistId);
          console.log(`✅ [EVENT] Marked tracking history ${ref.jntTrackingHistId} as processed for job ${jobId}`);
          return;
        }

        const createJobResult = await this.createJob(result.billcode, (attemptCount + 1)  || 0);
        if (!createJobResult.success || !createJobResult.job) {
          console.warn(`⚠️ [EVENT] Failed to create follow-up scan job: ${createJobResult.error || createJobResult.message}`);
          return;
        }

        const job = createJobResult.job;
        await this.createScanJobRef(job.id, ref.jntTrackingHistId);
        console.log(`✅ [TRACKING HIST] Created scan job with ID: ${job.id} for account: ${trackingHist.bankAccountName} and tracking code: ${result.billcode}`);
        this.runJobInBackground(job.id);

      } catch (error) {
        console.error(`❌ [EVENT] Failed to mark tracking history as processed:`, error);
      }
    });
  }
}

export const scanPhoneJobManager = new ScanPhoneJobManager();

// Initialize event listeners on startup
scanPhoneJobManager.setupEventListeners();