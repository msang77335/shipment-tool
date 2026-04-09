/**
 * Job Manager - Manages background scan phone jobs
 * Stores results locally in JSON files
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface ScanPhoneJob {
  id: string;
  codes: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  result?: {
    status: string;
    billcode: string;
    validPhones: string;
  };
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

class ScanPhoneJobManager {
  private jobsDir: string;

  constructor() {
    this.jobsDir = path.join(process.cwd(), 'data', 'scan_jobs');
    
    // Create jobs directory if it doesn't exist
    if (!fs.existsSync(this.jobsDir)) {
      fs.mkdirSync(this.jobsDir, { recursive: true });
      console.log(`📁 [SCAN JOBS] Created jobs directory: ${this.jobsDir}`);
    }
  }

  /**
   * Create a new scan phone job
   */
  createJob(codes: string): ScanPhoneJob {
    const job: ScanPhoneJob = {
      id: randomUUID(),
      codes,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    this.saveJob(job);
    console.log(`✅ [SCAN JOBS] Created job ${job.id} for codes: ${codes}`);

    return job;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): ScanPhoneJob | null {
    try {
      const filePath = this.getJobFilePath(jobId);
      
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ [SCAN JOBS] Job ${jobId} not found`);
        return null;
      }

      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`❌ [SCAN JOBS] Error retrieving job ${jobId}:`, error);
      return null;
    }
  }

  /**
   * Update job status to processing
   */
  setProcessing(jobId: string): void {
    const job = this.getJob(jobId);
    if (!job) return;

    job.status = 'processing';
    job.startedAt = new Date().toISOString();
    this.saveJob(job);
    console.log(`⏳ [SCAN JOBS] Job ${jobId} status: processing`);
  }

  /**
   * Mark job as completed with result
   */
  setSuccess(jobId: string, result: ScanPhoneJob['result']): void {
    const job = this.getJob(jobId);
    if (!job) return;

    job.status = 'success';
    job.result = result;
    job.completedAt = new Date().toISOString();
    this.saveJob(job);
    console.log(`✅ [SCAN JOBS] Job ${jobId} completed successfully`);
  }

  /**
   * Mark job as failed with error
   */
  setError(jobId: string, error: string): void {
    const job = this.getJob(jobId);
    if (!job) return;

    job.status = 'error';
    job.error = error;
    job.completedAt = new Date().toISOString();
    this.saveJob(job);
    console.log(`❌ [SCAN JOBS] Job ${jobId} failed: ${error}`);
  }

  /**
   * List all jobs
   */
  listJobs(limit: number = 100): ScanPhoneJob[] {
    try {
      const files = fs.readdirSync(this.jobsDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit);

      return files
        .map(f => this.getJob(f.replace('.json', '')))
        .filter((job): job is ScanPhoneJob => job !== null);
    } catch (error) {
      console.error(`❌ [SCAN JOBS] Error listing jobs:`, error);
      return [];
    }
  }

  /**
   * Clean up old jobs (older than specified days)
   */
  cleanupOldJobs(days: number = 7): number {
    try {
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      const files = fs.readdirSync(this.jobsDir);
      let deletedCount = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.jobsDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtimeMs < cutoffTime) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`🗑️ [SCAN JOBS] Cleaned up ${deletedCount} old jobs (older than ${days} days)`);
      }

      return deletedCount;
    } catch (error) {
      console.error(`❌ [SCAN JOBS] Error cleaning up jobs:`, error);
      return 0;
    }
  }

  /**
   * Private: Save job to file
   */
  private saveJob(job: ScanPhoneJob): void {
    try {
      const filePath = this.getJobFilePath(job.id);
      fs.writeFileSync(filePath, JSON.stringify(job, null, 2));
    } catch (error) {
      console.error(`❌ [SCAN JOBS] Error saving job ${job.id}:`, error);
    }
  }

  /**
   * Private: Get job file path
   */
  private getJobFilePath(jobId: string): string {
    return path.join(this.jobsDir, `${jobId}.json`);
  }
}

export const scanPhoneJobManager = new ScanPhoneJobManager();
