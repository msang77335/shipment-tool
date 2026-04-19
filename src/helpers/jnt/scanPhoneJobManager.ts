/**
 * Job Manager - Manages background scan phone jobs
 * Stores results in SQLite database
 */

import { scanPhoneJobsDb, type ScanPhoneJobEntry } from '../../database/scanPhoneJobs';
import { PhoneBruteForceFinder } from './scanPhone';
import { phoneManager } from './phone';

type JobStatus = 'pending' | 'processing' | 'paused' | 'success' | 'error';

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

class ScanPhoneJobManager {
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
   * Create a new scan phone job
   */
  async createJob(codes: string): Promise<ScanPhoneJob> {
    await this.ensureInitialized();
    const entry = await scanPhoneJobsDb.createJob(codes);
    
    return {
      id: entry.id!,
      codes: entry.codes,
      status: entry.status as JobStatus,
      createdAt: entry.createdAt!
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
   * Start background resume processing for a single job
   * @private
   */
  private async startBackgroundResume(job: ScanPhoneJob): Promise<void> {
    const abortSignal = this.createAbortSignal(job.id);

    (async () => {
      try {
        const allPhones = await phoneManager.getAllPhones();
        const phoneSet = new Set<string>();

        allPhones.forEach(group => {
          group.phones.forEach(phone => phoneSet.add(phone));
        });

        const phoneList = Array.from(phoneSet);

        if (phoneList.length === 0) {
          await this.setError(job.id, 'No phones available in pool');
          this.cleanupSignal(job.id);
          return;
        }

        const finder = new PhoneBruteForceFinder(async (attemptCount) => {
          await this.updateProgress(job.id, attemptCount);
        }, job.attemptCount || 0, abortSignal);

        const startFrom = Math.max(0, (job.attemptCount || 0));
        const result = await finder.findPhone(job.codes, phoneList, startFrom);

        await this.setSuccess(job.id, result, result.attemptCount);
        this.cleanupSignal(job.id);
      } catch (error) {
        if (error instanceof Error && error.message === 'JOB_ABORTED') {
          console.log(`✅ [AUTO RESUME] Job ${job.id} paused by user`);
        } else {
          const errorMsg = error instanceof Error ? error.message : String(error);
          await this.setError(job.id, errorMsg);
          console.error(`❌ [AUTO RESUME] Error in resumed job ${job.id}:`, error);
        }
        this.cleanupSignal(job.id);
      }
    })();
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

      console.log(`✅ [AUTO RESUME] Completed: ${resumed.length} resumed, ${errors.length} failed`);
      return { total: jobsToResume.length, resumed, errors };
    } catch (error) {
      console.error(`❌ [AUTO RESUME] Error during auto-resume:`, error);
      return { total: 0, resumed: [], errors: [{ jobId: 'unknown', error: String(error) }] };
    }
  }
}

export const scanPhoneJobManager = new ScanPhoneJobManager();
