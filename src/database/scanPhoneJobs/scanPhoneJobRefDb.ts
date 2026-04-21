/**
 * Scan Phone Jobs Reference Database Management using SQLite
 * Persistent storage for background scan phone jobs and JNT tracking history reference
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { DB_NAMES, DB_PATH } from '.';

export interface ScanPhoneJobRefEntry {
  id?: string;
  scanPhoneJobId: string;
  jntTrackingHistId: string;
  createdAt?: number;
}

class ScanPhoneJobRefDb {
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

      // Create scan phone jobs reference table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ${DB_NAMES.SCAN_PHONE_JOB_REF} (
          id TEXT PRIMARY KEY,
          scanPhoneJobId TEXT NOT NULL,
          jntTrackingHistId TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          FOREIGN KEY (scanPhoneJobId) REFERENCES ${DB_NAMES.SCAN_PHONE_JOBS}(id)
        );
        CREATE INDEX IF NOT EXISTS idx_scanPhoneJobId ON ${DB_NAMES.SCAN_PHONE_JOB_REF}(scanPhoneJobId);
        CREATE INDEX IF NOT EXISTS idx_jntTrackingHistId ON ${DB_NAMES.SCAN_PHONE_JOB_REF}(jntTrackingHistId);
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

  async addEntry(scanPhoneJobId: string, jntTrackingHistId: string): Promise<ScanPhoneJobRefEntry> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const id = crypto.randomUUID();
    const createdAt = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO ${DB_NAMES.SCAN_PHONE_JOB_REF} (id, scanPhoneJobId, jntTrackingHistId, createdAt)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, scanPhoneJobId, jntTrackingHistId, createdAt);

    return { id, scanPhoneJobId, jntTrackingHistId, createdAt };
  }

  /**
   * Get reference entry by scan phone job ID
   */
  async getByScanPhoneJobId(scanPhoneJobId: string): Promise<ScanPhoneJobRefEntry | null> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`SELECT * FROM ${DB_NAMES.SCAN_PHONE_JOB_REF} WHERE scanPhoneJobId = ?`);
    const entry = stmt.get(scanPhoneJobId) as ScanPhoneJobRefEntry | undefined;
    return entry || null;
  }
}


// Export singleton instance
export const scanPhoneJobRefDb = new ScanPhoneJobRefDb();
