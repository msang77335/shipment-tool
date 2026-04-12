/**
 * Proxies Database Management using SQLite
 * Persistent storage for proxy pool
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';

const DB_NAMES = {
  PROXIES: 'proxies',
};
const DB_PATH = join(process.cwd(), 'data', 'sqlite.db');

export interface ProxyRecord {
  id?: number;
  server: string;
  username?: string;
  password?: string;
  bypass?: string;
  createdAt: number;
  updatedAt: number;
}

class ProxiesDb {
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

      // Create proxies table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ${DB_NAMES.PROXIES} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          server TEXT NOT NULL UNIQUE COLLATE NOCASE,
          username TEXT,
          password TEXT,
          bypass TEXT,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_server ON ${DB_NAMES.PROXIES}(server);
        CREATE INDEX IF NOT EXISTS idx_createdAt ON ${DB_NAMES.PROXIES}(createdAt);
      `);

      // Verify table was created
      const tableExists = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${DB_NAMES.PROXIES}'`).get();
      if (!tableExists) {
        throw new Error('Failed to create proxies table');
      }

      this.initialized = true;
      const count = this.db.prepare(`SELECT COUNT(*) as count FROM ${DB_NAMES.PROXIES}`).get() as any;
      console.log(`✅ [PROXIES DB] Table initialized with ${count.count} entries`);
    } catch (error) {
      console.error(`❌ [PROXIES DB] Initialization error:`, error);
      throw error;
    }
  }

  /**
   * Add or update a proxy (upsert)
   */
  async saveProxy(proxy: Omit<ProxyRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProxyRecord> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const now = Date.now();
      const existing = this.db.prepare(`SELECT id, createdAt FROM ${DB_NAMES.PROXIES} WHERE server = ?`).get(proxy.server) as any;

      if (existing) {
        // Update existing
        this.db.prepare(`
          UPDATE ${DB_NAMES.PROXIES} 
          SET username = ?, password = ?, bypass = ?, updatedAt = ?
          WHERE server = ?
        `).run(proxy.username || null, proxy.password || null, proxy.bypass || null, now, proxy.server);

        return {
          id: existing.id,
          ...proxy,
          createdAt: existing.createdAt,
          updatedAt: now,
        };
      } else {
        // Insert new
        const stmt = this.db.prepare(`
          INSERT INTO ${DB_NAMES.PROXIES} (server, username, password, bypass, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(proxy.server, proxy.username || null, proxy.password || null, proxy.bypass || null, now, now);

        return {
          id: result.lastInsertRowid as number,
          ...proxy,
          createdAt: now,
          updatedAt: now,
        };
      }
    } catch (error) {
      console.error(`❌ [PROXIES DB] Save error:`, error);
      throw error;
    }
  }

  /**
   * Get a single proxy by server address
   */
  async getProxy(server: string): Promise<ProxyRecord | null> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = this.db.prepare(
        `SELECT id, server, username, password, bypass, createdAt, updatedAt FROM ${DB_NAMES.PROXIES} WHERE server = ?`
      ).get(server) as ProxyRecord | undefined;

      return result || null;
    } catch (error) {
      console.error(`❌ [PROXIES DB] Get error:`, error);
      throw error;
    }
  }

  /**
   * Get all proxies
   */
  async getAllProxies(): Promise<ProxyRecord[]> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const results = this.db.prepare(
        `SELECT id, server, username, password, bypass, createdAt, updatedAt FROM ${DB_NAMES.PROXIES} ORDER BY createdAt DESC`
      ).all() as ProxyRecord[];

      return results;
    } catch (error) {
      console.error(`❌ [PROXIES DB] Get all error:`, error);
      throw error;
    }
  }

  /**
   * Remove a proxy by server address
   */
  async removeProxy(server: string): Promise<boolean> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = this.db.prepare(`DELETE FROM ${DB_NAMES.PROXIES} WHERE server = ?`).run(server);
      return (result.changes ?? 0) > 0;
    } catch (error) {
      console.error(`❌ [PROXIES DB] Remove error:`, error);
      throw error;
    }
  }

  /**
   * Clear all proxies
   */
  async clearAllProxies(): Promise<number> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = this.db.prepare(`DELETE FROM ${DB_NAMES.PROXIES}`).run();
      return result.changes ?? 0;
    } catch (error) {
      console.error(`❌ [PROXIES DB] Clear error:`, error);
      throw error;
    }
  }

  /**
   * Get proxy count
   */
  async getProxyCount(): Promise<number> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${DB_NAMES.PROXIES}`).get() as any;
      return result.count;
    } catch (error) {
      console.error(`❌ [PROXIES DB] Count error:`, error);
      throw error;
    }
  }
}

// Singleton instance
export const proxiesDb = new ProxiesDb();
