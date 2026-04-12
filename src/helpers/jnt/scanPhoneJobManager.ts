/**
 * Job Manager - Manages background scan phone jobs
 * Stores results in SQLite database
 */

import { scanPhoneJobsDb, type ScanPhoneJobEntry } from '../../database/scanPhoneJobs';

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
   * Pause a processing job
   */
  async pauseJob(jobId: string): Promise<void> {
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
   * Get job statistics
   */
  async getStats(): Promise<{ total: number; pending: number; processing: number; success: number; error: number }> {
    await this.ensureInitialized();
    const counts = await scanPhoneJobsDb.getCountByStatus();

    const countValues = Object.values(counts) as number[];
    const total = countValues.reduce((sum, count) => sum + count, 0);

    return {
      total,
      pending: counts['pending'] || 0,
      processing: counts['processing'] || 0,
      success: counts['success'] || 0,
      error: counts['error'] || 0
    };
  }

  /**
   * Clean up old jobs (older than specified days)
   */
  async cleanupOldJobs(days: number = 7): Promise<number> {
    await this.ensureInitialized();
    return await scanPhoneJobsDb.cleanupOldJobs(days);
  }
}

export const scanPhoneJobManager = new ScanPhoneJobManager();
