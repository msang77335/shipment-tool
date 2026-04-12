/**
 * Blacklist Database Management using SQLite
 * Persistent storage for proxy blacklist entries
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { DB_NAMES, DB_PATH } from '.';

export interface BlacklistEntry {
  provider: string;
  proxyServer?: string;
  reason: 'QUOTA_EXCEEDED' | 'IP_BLOCKED' | 'RATE_LIMITED' | 'OTHER';
  timestamp: number;
  code?: string;
}

class BlacklistDb {
  private db: Database.Database | null = null;
  private dbPath: string;
  private initialized: boolean = false;

  constructor() {
    // Store blacklist in data directory
    this.dbPath = DB_PATH
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

      // Create blacklist table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ${DB_NAMES.BLACKLIST} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider TEXT NOT NULL,
          proxyServer TEXT,
          reason TEXT NOT NULL CHECK(reason IN ('QUOTA_EXCEEDED', 'IP_BLOCKED', 'RATE_LIMITED', 'OTHER')),
          timestamp INTEGER NOT NULL,
          code TEXT,
          UNIQUE(provider, proxyServer)
        );
        CREATE INDEX IF NOT EXISTS idx_provider ON ${DB_NAMES.BLACKLIST}(provider);
        CREATE INDEX IF NOT EXISTS idx_proxyServer ON ${DB_NAMES.BLACKLIST}(proxyServer);
        CREATE INDEX IF NOT EXISTS idx_reason ON ${DB_NAMES.BLACKLIST}(reason);
        CREATE INDEX IF NOT EXISTS idx_timestamp ON ${DB_NAMES.BLACKLIST}(timestamp);
      `);

      // Verify table was created
      const tableExists = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${DB_NAMES.BLACKLIST}'`).get();
      if (!tableExists) {
        throw new Error('Failed to create blacklist table');
      }

      this.initialized = true;
      const count = this.db.prepare(`SELECT COUNT(*) as count FROM ${DB_NAMES.BLACKLIST}`).get() as any;
      console.log(`✅ [BLACKLIST DB] Table initialized with ${count.count} entries`);
    } catch (error) {
      console.error(`❌ [BLACKLIST DB] Initialization error:`, error);
      throw error;
    }
  }

  /**
   * Add an entry to blacklist
   */
  async addEntry(entry: BlacklistEntry): Promise<void> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`
        INSERT INTO ${DB_NAMES.BLACKLIST} (provider, proxyServer, reason, timestamp, code)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(provider, proxyServer) DO UPDATE SET
          reason = excluded.reason,
          timestamp = excluded.timestamp,
          code = excluded.code
      `);

      stmt.run(entry.provider, entry.proxyServer || null, entry.reason, entry.timestamp, entry.code || null);

      const proxyInfo = entry.proxyServer ? ` (${entry.proxyServer})` : '';
      console.log(`🚫 [BLACKLIST DB] Added ${entry.provider}${proxyInfo} - Reason: ${entry.reason}`);
    } catch (error) {
      console.error(`❌ [BLACKLIST DB] Error adding entry:`, error);
      throw error;
    }
  }

  /**
   * Remove an entry from blacklist
   */
  async removeEntry(provider: string, proxyServer?: string): Promise<boolean> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      let stmt;
      let result;

      if (proxyServer) {
        stmt = this.db.prepare(`DELETE FROM ${DB_NAMES.BLACKLIST} WHERE provider = ? AND proxyServer = ?`);
        result = stmt.run(provider, proxyServer);
      } else {
        stmt = this.db.prepare(`DELETE FROM ${DB_NAMES.BLACKLIST} WHERE provider = ? AND proxyServer IS NULL`);
        result = stmt.run(provider);
      }

      const removed = (result as any).changes > 0;

      if (removed) {
        const proxyInfo = proxyServer ? ` (${proxyServer})` : '';
        console.log(`✅ [BLACKLIST DB] Removed ${provider}${proxyInfo}`);
      }

      return removed;
    } catch (error) {
      console.error(`❌ [BLACKLIST DB] Error removing entry:`, error);
      throw error;
    }
  }

  /**
   * Get all entries
   */
  async getAll(): Promise<BlacklistEntry[]> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`SELECT provider, proxyServer, reason, timestamp, code FROM ${DB_NAMES.BLACKLIST} ORDER BY timestamp DESC`);
      return stmt.all() as BlacklistEntry[];
    } catch (error) {
      console.error(`❌ [BLACKLIST DB] Error getting all entries:`, error);
      throw error;
    }
  }

  /**
   * Get entries by proxy server
   */
  async getByProxyServer(proxyServer: string): Promise<BlacklistEntry[]> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`SELECT provider, proxyServer, reason, timestamp, code FROM ${DB_NAMES.BLACKLIST} WHERE proxyServer = ? ORDER BY timestamp DESC`);
      return stmt.all(proxyServer) as BlacklistEntry[];
    } catch (error) {
      console.error(`❌ [BLACKLIST DB] Error getting entries by proxy:`, error);
      throw error;
    }
  }

  /**
   * Get entries by reason
   */
  async getByReason(reason: BlacklistEntry['reason']): Promise<BlacklistEntry[]> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`SELECT provider, proxyServer, reason, timestamp, code FROM ${DB_NAMES.BLACKLIST} WHERE reason = ? ORDER BY timestamp DESC`);
      return stmt.all(reason) as BlacklistEntry[];
    } catch (error) {
      console.error(`❌ [BLACKLIST DB] Error getting entries by reason:`, error);
      throw error;
    }
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      this.db.exec(`DELETE FROM ${DB_NAMES.BLACKLIST}`);
      console.log(`🗑️ [BLACKLIST DB] Cleared all entries`);
    } catch (error) {
      console.error(`❌ [BLACKLIST DB] Error clearing entries:`, error);
      throw error;
    }
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    total: number;
    byReason: Record<string, number>;
    byProvider: Record<string, number>;
  }> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const totalResult = this.db.prepare(`SELECT COUNT(*) as count FROM ${DB_NAMES.BLACKLIST}`).get() as any;
      const reasonResult = this.db.prepare(`SELECT reason, COUNT(*) as count FROM ${DB_NAMES.BLACKLIST} GROUP BY reason`).all() as any[];
      const providerResult = this.db.prepare(`SELECT provider, COUNT(*) as count FROM ${DB_NAMES.BLACKLIST} GROUP BY provider`).all() as any[];

      const byReason: Record<string, number> = {};
      const byProvider: Record<string, number> = {};

      reasonResult.forEach(row => {
        byReason[row.reason] = row.count;
      });

      providerResult.forEach(row => {
        byProvider[row.provider] = row.count;
      });

      return {
        total: totalResult.count,
        byReason,
        byProvider
      };
    } catch (error) {
      console.error(`❌ [BLACKLIST DB] Error getting stats:`, error);
      throw error;
    }
  }

  /**
   * Clean up old entries (older than ttl milliseconds)
   */
  async cleanupOld(ttlMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const now = Date.now();
      const cutoffTime = now - ttlMs;

      const stmt = this.db.prepare(`DELETE FROM ${DB_NAMES.BLACKLIST} WHERE timestamp < ?`);
      const result = stmt.run(cutoffTime);

      const removed = (result as any).changes;

      if (removed > 0) {
        console.log(`🗑️ [BLACKLIST DB] Cleaned up ${removed} old entries`);
      }

      return removed;
    } catch (error) {
      console.error(`❌ [BLACKLIST DB] Error cleaning up:`, error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
      console.log(`✅ [BLACKLIST DB] Closed`);
    }
  }
}

// Singleton instance
export const blacklistDb = new BlacklistDb();
