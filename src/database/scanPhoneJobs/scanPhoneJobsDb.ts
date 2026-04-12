/**
 * Scan Phone Jobs Database Management using SQLite
 * Persistent storage for background scan phone jobs
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { DB_NAMES, DB_PATH } from '.';
import { randomUUID } from 'node:crypto';

export interface ScanPhoneJobEntry {
  id?: string;
  codes: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  result?: string; // Stored as JSON string
  error?: string;
  attemptCount?: number; // Number of brute force attempts made
  createdAt?: number;
  startedAt?: number;
  completedAt?: number;
}

class ScanPhoneJobsDb {
  private db: Database.Database | null = null;
  private dbPath: string;
  private initialized: boolean = false;

  constructor() {
    this.dbPath = DB_PATH;
  }

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create data directory if not exists
      const { mkdirSync } = await import('node:fs');
      mkdirSync(join(process.cwd(), 'data'), { recursive: true });

      // Initialize SQLite database
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = DELETE');
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('synchronous = NORMAL');

      // Create scan phone jobs table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ${DB_NAMES.SCAN_PHONE_JOBS} (
          id TEXT PRIMARY KEY,
          codes TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'paused', 'success', 'error')),
          result TEXT,
          error TEXT,
          attemptCount INTEGER,
          createdAt INTEGER NOT NULL,
          startedAt INTEGER,
          completedAt INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_status ON ${DB_NAMES.SCAN_PHONE_JOBS}(status);
        CREATE INDEX IF NOT EXISTS idx_codes ON ${DB_NAMES.SCAN_PHONE_JOBS}(codes);
        CREATE INDEX IF NOT EXISTS idx_createdAt ON ${DB_NAMES.SCAN_PHONE_JOBS}(createdAt DESC);
      `);
      
      // Migration: Add paused status support if needed (if table already exists)
      if (this.initialized === false) {
        try {
          // Only run migration for existing databases, new ones already have it
          const checkStatus = this.db.prepare(`PRAGMA table_info(${DB_NAMES.SCAN_PHONE_JOBS})`).all() as any[];
          const hasPausedSupport = checkStatus.some(col => col.name === 'status');
          if (hasPausedSupport) {
            // Table exists, migration already handled
          }
        } catch (e: any) {
          // Table doesn't exist yet (new database), skip migration
          if (!e.message.includes('no such table')) {
            throw e;
          }
        }
      }

      // Verify table was created
      const tableExists = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${DB_NAMES.SCAN_PHONE_JOBS}'`).get();
      if (!tableExists) {
        throw new Error('Failed to create scan phone jobs table');
      }

      this.initialized = true;
      const count = this.db.prepare(`SELECT COUNT(*) as count FROM ${DB_NAMES.SCAN_PHONE_JOBS}`).get() as any;
      console.log(`✅ [SCAN PHONE JOBS DB] Table initialized with ${count.count} entries`);
    } catch (error) {
      console.error(`❌ [SCAN PHONE JOBS DB] Initialization error:`, error);
      throw error;
    }
  }

  /**
   * Create a new job entry
   */
  async createJob(codes: string): Promise<ScanPhoneJobEntry> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const id = randomUUID();
      const timestamp = Date.now();

      const stmt = this.db.prepare(`
        INSERT INTO ${DB_NAMES.SCAN_PHONE_JOBS} (id, codes, status, createdAt)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(id, codes, 'pending', timestamp);

      console.log(`✅ [SCAN PHONE JOBS DB] Created job: ${id} for codes: ${codes}`);

      return { id, codes, status: 'pending', createdAt: timestamp };
    } catch (error) {
      console.error(`❌ [SCAN PHONE JOBS DB] Error creating job:`, error);
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<ScanPhoneJobEntry | null> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`
        SELECT id, codes, status, result, error, attemptCount, createdAt, startedAt, completedAt
        FROM ${DB_NAMES.SCAN_PHONE_JOBS}
        WHERE id = ?
      `);

      return stmt.get(jobId) as ScanPhoneJobEntry | undefined || null;
    } catch (error) {
      console.error(`❌ [SCAN PHONE JOBS DB] Error getting job:`, error);
      return null;
    }
  }

  /**
   * Update job to processing status
   */
  async setProcessing(jobId: string): Promise<void> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const timestamp = Date.now();
      const stmt = this.db.prepare(`
        UPDATE ${DB_NAMES.SCAN_PHONE_JOBS}
        SET status = ?, startedAt = ?
        WHERE id = ?
      `);

      stmt.run('processing', timestamp, jobId);
      console.log(`⏳ [SCAN PHONE JOBS DB] Job ${jobId} status: processing`);
    } catch (error) {
      console.error(`❌ [SCAN PHONE JOBS DB] Error updating job to processing:`, error);
      throw error;
    }
  }

  /**
   * Mark job as completed with success
   */
  async setSuccess(jobId: string, result: any, attemptCount?: number): Promise<void> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const timestamp = Date.now();
      const resultJson = JSON.stringify(result);

      const stmt = this.db.prepare(`
        UPDATE ${DB_NAMES.SCAN_PHONE_JOBS}
        SET status = ?, result = ?, attemptCount = ?, completedAt = ?
        WHERE id = ?
      `);

      stmt.run('success', resultJson, attemptCount || null, timestamp, jobId);
      console.log(`✅ [SCAN PHONE JOBS DB] Job ${jobId} completed successfully (${attemptCount || 0} attempts)`);
    } catch (error) {
      console.error(`❌ [SCAN PHONE JOBS DB] Error marking job as success:`, error);
      throw error;
    }
  }

  /**
   * Mark job as failed with error
   */
  async setError(jobId: string, error: string): Promise<void> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const timestamp = Date.now();

      const stmt = this.db.prepare(`
        UPDATE ${DB_NAMES.SCAN_PHONE_JOBS}
        SET status = ?, error = ?, completedAt = ?
        WHERE id = ?
      `);

      stmt.run('error', error, timestamp, jobId);
      console.log(`❌ [SCAN PHONE JOBS DB] Job ${jobId} failed: ${error}`);
    } catch (error) {
      console.error(`❌ [SCAN PHONE JOBS DB] Error marking job as error:`, error);
      throw error;
    }
  }

  /**
   * Pause a processing job (keep attemptCount)
   */
  async pauseJob(jobId: string): Promise<void> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`
        UPDATE ${DB_NAMES.SCAN_PHONE_JOBS}
        SET status = ?
        WHERE id = ? AND status = ?
      `);

      stmt.run('paused', jobId, 'processing');
      console.log(`⏸️ [SCAN PHONE JOBS DB] Job ${jobId} paused`);
    } catch (error) {
      console.error(`❌ [SCAN PHONE JOBS DB] Error pausing job:`, error);
      throw error;
    }
  }

  /**
   * Resume a paused job (set back to processing)
   */
  async resumeJob(jobId: string): Promise<void> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`
        UPDATE ${DB_NAMES.SCAN_PHONE_JOBS}
        SET status = ?
        WHERE id = ? AND status = ?
      `);

      stmt.run('processing', jobId, 'paused');
      console.log(`▶️ [SCAN PHONE JOBS DB] Job ${jobId} resumed`);
    } catch (error) {
      console.error(`❌ [SCAN PHONE JOBS DB] Error resuming job:`, error);
      throw error;
    }
  }

  /**
   * Update job attempt count (real-time progress tracking during brute force)
   * Does NOT change job status
   */
  async updateProgress(jobId: string, attemptCount: number): Promise<void> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`
        UPDATE ${DB_NAMES.SCAN_PHONE_JOBS}
        SET attemptCount = ?
        WHERE id = ?
      `);

      stmt.run(attemptCount, jobId);
      // Silent update - don't spam logs
    } catch (error) {
      console.error(`❌ [SCAN PHONE JOBS DB] Error updating progress:`, error);
      throw error;
    }
  }

  /**
   * List jobs with optional filters
   */
  async listJobs(params: {
    limit?: number;
    status?: 'pending' | 'processing' | 'paused' | 'success' | 'error';
  } = {}): Promise<ScanPhoneJobEntry[]> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const { limit = 100, status } = params;
      const limitNum = Math.min(Math.max(limit, 1), 500);

      let query = `
        SELECT id, codes, status, result, error, attemptCount, createdAt, startedAt, completedAt
        FROM ${DB_NAMES.SCAN_PHONE_JOBS}
      `;
      const params_arr: any[] = [];

      if (status) {
        query += ` WHERE status = ?`;
        params_arr.push(status);
      }

      query += ` ORDER BY createdAt DESC LIMIT ?`;
      params_arr.push(limitNum);

      const stmt = this.db.prepare(query);
      return stmt.all(...params_arr) as ScanPhoneJobEntry[];
    } catch (error) {
      console.error(`❌ [SCAN PHONE JOBS DB] Error listing jobs:`, error);
      return [];
    }
  }

  /**
   * Clean up old jobs (older than specified days)
   */
  async cleanupOldJobs(days: number = 7): Promise<number> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

      const stmt = this.db.prepare(`
        DELETE FROM ${DB_NAMES.SCAN_PHONE_JOBS}
        WHERE createdAt < ?
      `);

      const result = stmt.run(cutoffTime) as any;
      const deletedCount = result.changes;

      if (deletedCount > 0) {
        console.log(`🗑️ [SCAN PHONE JOBS DB] Cleaned up ${deletedCount} old jobs (older than ${days} days)`);
      }

      return deletedCount;
    } catch (error) {
      console.error(`❌ [SCAN PHONE JOBS DB] Error cleaning up jobs:`, error);
      return 0;
    }
  }

  /**
   * Get job count by status
   */
  async getCountByStatus(): Promise<Record<string, number>> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`
        SELECT status, COUNT(*) as count
        FROM ${DB_NAMES.SCAN_PHONE_JOBS}
        GROUP BY status
      `);

      const results = stmt.all() as Array<{ status: string; count: number }>;
      const counts: Record<string, number> = {};

      results.forEach(row => {
        counts[row.status] = row.count;
      });

      return counts;
    } catch (error) {
      console.error(`❌ [SCAN PHONE JOBS DB] Error getting counts:`, error);
      return {};
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      try {
        this.db.close();
        this.db = null;
        this.initialized = false;
        console.log(`✅ [SCAN PHONE JOBS DB] Database closed`);
      } catch (error) {
        console.error(`❌ [SCAN PHONE JOBS DB] Error closing database:`, error);
        throw error;
      }
    }
  }
}

// Export singleton instance
export const scanPhoneJobsDb = new ScanPhoneJobsDb();
