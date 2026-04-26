/**
 * JNT Tracking History Database Management using SQLite
 * Persistent storage for JNT tracking records
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { DB_NAMES, DB_PATH } from '.';

export interface JNTTrackingHistEntry {
  id?: string;
  codes: string;
  bankAccountName: string;
  site: "J&T" | "AfterShip";
  status?: 'pending' | 'processed' | 'failed';
  addedAt?: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  site?: "J&T" | "AfterShip";
  sortBy?: 'recent' | 'oldest';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class JNTTrackingHistDb {
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

      // Create tracking history table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ${DB_NAMES.JNT_TRACKING_HIST} (
          id TEXT PRIMARY KEY,
          codes TEXT NOT NULL,
          bankAccountName TEXT,
          site TEXT NOT NULL CHECK(site IN ('J&T', 'AfterShip')),
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processed', 'failed')),
          addedAt INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_site ON ${DB_NAMES.JNT_TRACKING_HIST}(site);
        CREATE INDEX IF NOT EXISTS idx_codes ON ${DB_NAMES.JNT_TRACKING_HIST}(codes);
        CREATE INDEX IF NOT EXISTS idx_bankAccountName ON ${DB_NAMES.JNT_TRACKING_HIST}(bankAccountName);
        CREATE INDEX IF NOT EXISTS idx_status ON ${DB_NAMES.JNT_TRACKING_HIST}(status);
        CREATE INDEX IF NOT EXISTS idx_addedAt ON ${DB_NAMES.JNT_TRACKING_HIST}(addedAt DESC);
      `);

      // Add status column if it doesn't exist (migration)
      try {
        this.db.prepare(`ALTER TABLE ${DB_NAMES.JNT_TRACKING_HIST} ADD COLUMN status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processed', 'failed'))`).run();
      } catch (err: any) {
        if (!err.message.includes('duplicate column')) {
          throw err;
        }
      }

      // Verify table was created
      const tableExists = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${DB_NAMES.JNT_TRACKING_HIST}'`).get();
      if (!tableExists) {
        throw new Error('Failed to create tracking history table');
      }

      this.initialized = true;
      const count = this.db.prepare(`SELECT COUNT(*) as count FROM ${DB_NAMES.JNT_TRACKING_HIST}`).get() as any;
      console.log(`✅ [JNT TRACKING HIST DB] Table initialized with ${count.count} entries`);
    } catch (error) {
      console.error(`❌ [JNT TRACKING HIST DB] Initialization error:`, error);
      throw error;
    }
  }

  /**
   * Get a tracking history entry by ID
   */
  async getById(id: string): Promise<JNTTrackingHistEntry | null> {
    if (!this.initialized) throw new Error('Database not initialized');
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`
        SELECT id, codes, bankAccountName, site, status, addedAt
        FROM ${DB_NAMES.JNT_TRACKING_HIST}
        WHERE id = ?
      `);
      const data = stmt.get(id) as JNTTrackingHistEntry;
      return data || null;
    } catch (error) {
      console.error(`❌ [JNT TRACKING HIST DB] Error getting entry by ID:`, error);
      throw error;
    }
  }

  /**
   * Add a tracking history entry
   */
  async addEntry(codes: string, bankAccountName: string, site: "J&T" | "AfterShip"): Promise<JNTTrackingHistEntry> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const id = randomUUID();
      const timestamp = Date.now();

      const stmt = this.db.prepare(`
        INSERT INTO ${DB_NAMES.JNT_TRACKING_HIST} (id, codes, bankAccountName, site, status, addedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(id, codes, bankAccountName || null, site, 'pending', timestamp);

      console.log(`✅ [JNT TRACKING HIST DB] Added tracking: ${id} (${codes}, ${site})`);

      return { id, codes, bankAccountName, site, addedAt: timestamp };
    } catch (error) {
      console.error(`❌ [JNT TRACKING HIST DB] Error adding entry:`, error);
      throw error;
    }
  }

  /**
   * Get all tracking history with pagination
   */
  async getAllHist(params: PaginationParams = {}): Promise<PaginatedResult<JNTTrackingHistEntry>> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const { page = 1, limit = 50, site, sortBy = 'recent' } = params;

      // Validate pagination params
      const itemsPerPage = Math.min(Math.max(limit, 1), 500); // Min 1, Max 500
      const pageNum = Math.max(page, 1);
      const offset = (pageNum - 1) * itemsPerPage;

      // Build WHERE clause
      let whereClause = '';
      const whereParams: any[] = [];

      if (site) {
        whereClause = 'WHERE site = ?';
        whereParams.push(site);
      }

      // Get total count
      const countStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM ${DB_NAMES.JNT_TRACKING_HIST}
        ${whereClause}
      `);
      const countResult = countStmt.all(...whereParams)[0] as any;
      const total = countResult.count;

      // Build ORDER BY clause
      const orderBy = sortBy === 'recent' ? 'DESC' : 'ASC';

      // Get paginated data
      const stmt = this.db.prepare(`
        SELECT id, codes, bankAccountName, site, status, addedAt
        FROM ${DB_NAMES.JNT_TRACKING_HIST}
        ${whereClause}
        ORDER BY addedAt ${orderBy}
        LIMIT ? OFFSET ?
      `);

      const data = stmt.all(...whereParams, itemsPerPage, offset) as JNTTrackingHistEntry[];

      const totalPages = Math.ceil(total / itemsPerPage);

      console.log(`📋 [JNT TRACKING HIST DB] Retrieved page ${pageNum}/${totalPages} (${data.length} entries)`);

      return {
        data,
        pagination: {
          page: pageNum,
          limit: itemsPerPage,
          total,
          totalPages
        }
      };
    } catch (error) {
      console.error(`❌ [JNT TRACKING HIST DB] Error getting history:`, error);
      throw error;
    }
  }

  /**
   * Get tracking history by specific site
   */
  async getHistBySite(site: "J&T" | "AfterShip", params: PaginationParams = {}): Promise<PaginatedResult<JNTTrackingHistEntry>> {
    return this.getAllHist({ ...params, site });
  }

  /**
   * Get 1 unprocessed AfterShip tracking history entry that is ready for phone scan
   * Only returns entries from bankAccountNames that have > 2 pending items
   */
  async getHistReadyForPhoneScan(): Promise<JNTTrackingHistEntry | null> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`
        SELECT id, codes, bankAccountName, site, status, addedAt
        FROM ${DB_NAMES.JNT_TRACKING_HIST}
        WHERE site = 'AfterShip' AND codes LIKE '%,%' AND status = 'pending'
        AND bankAccountName IN (
          SELECT bankAccountName 
          FROM ${DB_NAMES.JNT_TRACKING_HIST}
          WHERE site = 'AfterShip' AND status = 'pending'
          GROUP BY bankAccountName
          HAVING COUNT(*) >= 2
        )
        ORDER BY addedAt ASC
        LIMIT 1
      `);

      const data = stmt.get() as JNTTrackingHistEntry;
      console.log(`📞 [JNT TRACKING HIST DB] Found ${data ? 1 : 0} entries ready for phone scan (bankAccountName with > 2 items)`);
      return data || null;
    } catch (error) {
      console.error(`❌ [JNT TRACKING HIST DB] Error getting history for phone scan:`, error);
      throw error;
    }
  }

  /**
   * Mark a tracking history entry as processed
   */
  async markAsProcessed(id: string): Promise<void> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`
        UPDATE ${DB_NAMES.JNT_TRACKING_HIST}
        SET status = 'processed'
        WHERE id = ?
      `);
      stmt.run(id);
      console.log(`✅ [JNT TRACKING HIST DB] Marked entry ${id} as processed`);
    } catch (error) {
      console.error(`❌ [JNT TRACKING HIST DB] Error marking as processed:`, error);
      throw error;
    }
  }

  /**
   * Mark a tracking history entry as failed
   */
  async markAsFailed(id: string): Promise<void> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`
        UPDATE ${DB_NAMES.JNT_TRACKING_HIST}
        SET status = 'failed'
        WHERE id = ?
      `);
      stmt.run(id);
      console.log(`✅ [JNT TRACKING HIST DB] Marked entry ${id} as failed`);
    } catch (error) {
      console.error(`❌ [JNT TRACKING HIST DB] Error marking as failed:`, error);
      throw error;
    }
  }

  /**
   * Delete a tracking history entry by ID
   */
  async deleteById(id: string): Promise<boolean> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`DELETE FROM ${DB_NAMES.JNT_TRACKING_HIST} WHERE id = ?`);
      const result = stmt.run(id) as any;
      console.log(`✅ [JNT TRACKING HIST DB] Deleted entry ${id} (changes: ${result.changes})`);
      return result.changes > 0;
    } catch (error) {
      console.error(`❌ [JNT TRACKING HIST DB] Error deleting entry by ID:`, error);
      throw error;
    }
  }

  /**
   * Clear all tracking history
   */
  async clearHist(): Promise<number> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`DELETE FROM ${DB_NAMES.JNT_TRACKING_HIST}`);
      const result = stmt.run() as any;
      console.log(`✅ [JNT TRACKING HIST DB] Cleared ${result.changes} entries`);
      return result.changes;
    } catch (error) {
      console.error(`❌ [JNT TRACKING HIST DB] Error clearing history:`, error);
      throw error;
    }
  }

  /**
   * Clear history by status
   */
  async clearHistByStatus(status: 'pending' | 'processed' | 'failed'): Promise<number> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`
        DELETE FROM ${DB_NAMES.JNT_TRACKING_HIST}
        WHERE status = ?
      `);
      const result = stmt.run(status) as any;
      console.log(`✅ [JNT TRACKING HIST DB] Cleared ${result.changes} entries with status "${status}"`);
      return result.changes;
    } catch (error) {
      console.error(`❌ [JNT TRACKING HIST DB] Error clearing history by status:`, error);
      throw error;
    }
  }

  /**
   * Clear history by date range
   */
  async clearHistByDateRange(startTime: number, endTime: number): Promise<number> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`
        DELETE FROM ${DB_NAMES.JNT_TRACKING_HIST}
        WHERE addedAt >= ? AND addedAt <= ?
      `);
      const result = stmt.run(startTime, endTime) as any;
      console.log(`✅ [JNT TRACKING HIST DB] Cleared ${result.changes} entries from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
      return result.changes;
    } catch (error) {
      console.error(`❌ [JNT TRACKING HIST DB] Error clearing history by date:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const jntTrackingHistDb = new JNTTrackingHistDb();
