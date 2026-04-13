/**
 * JNT Phones Database Management using SQLite
 * Persistent storage for JNT phone numbers grouped by names
 */

import Database from 'better-sqlite3';
import { join } from 'node:path';
import { DB_NAMES, DB_PATH } from '.';

export interface JNTPhoneEntry {
  id?: number;
  name: string;
  phone: string;
  addedAt: number;
}

class JNTPhonesDb {
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

      // Create JNT phones table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ${DB_NAMES.JNT_PHONES} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL COLLATE NOCASE,
          phone TEXT NOT NULL,
          addedAt INTEGER NOT NULL,
          UNIQUE(name, phone)
        );
        CREATE INDEX IF NOT EXISTS idx_name ON ${DB_NAMES.JNT_PHONES}(name);
        CREATE INDEX IF NOT EXISTS idx_phone ON ${DB_NAMES.JNT_PHONES}(phone);
        CREATE INDEX IF NOT EXISTS idx_addedAt ON ${DB_NAMES.JNT_PHONES}(addedAt);
      `);

      // Verify table was created
      const tableExists = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='${DB_NAMES.JNT_PHONES}'`).get();
      if (!tableExists) {
        throw new Error('Failed to create JNT phones table');
      }

      this.initialized = true;
      const count = this.db.prepare(`SELECT COUNT(*) as count FROM ${DB_NAMES.JNT_PHONES}`).get() as any;
      console.log(`✅ [JNT PHONES DB] Table initialized with ${count.count} entries`);
    } catch (error) {
      console.error(`❌ [JNT PHONES DB] Initialization error:`, error);
      throw error;
    }
  }

  /**
   * Add a single phone entry
   */
  async addEntry(name: string, phone: string): Promise<JNTPhoneEntry> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const normalizedName = name.trim().toLowerCase().replaceAll(/\s+/, '');
      const timestamp = Date.now();

      const stmt = this.db.prepare(`
        INSERT INTO ${DB_NAMES.JNT_PHONES} (name, phone, addedAt)
        VALUES (?, ?, ?)
        ON CONFLICT(name, phone) DO NOTHING
      `);

      const result = stmt.run(normalizedName, phone, timestamp) as any;

      if (result.changes > 0) {
        console.log(`✅ [JNT PHONES DB] Added phone: ${phone} under name: ${name}`);
        return { id: result.lastInsertRowid as number, name: normalizedName, phone, addedAt: timestamp };
      } else {
        console.warn(`⚠️ [JNT PHONES DB] Phone ${phone} already exists under name: ${name}`);
        const existing = this.db.prepare(`SELECT * FROM ${DB_NAMES.JNT_PHONES} WHERE name = ? AND phone = ?`).get(normalizedName, phone) as JNTPhoneEntry;
        return existing;
      }
    } catch (error) {
      console.error(`❌ [JNT PHONES DB] Error adding entry:`, error);
      throw error;
    }
  }

  /**
   * Get all phones for a specific name
   */
  async getPhonesByName(name: string): Promise<string[] | null> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const normalizedName = name.trim().toLowerCase().replaceAll(/\s+/, '');
      const stmt = this.db.prepare(`
        SELECT phone FROM ${DB_NAMES.JNT_PHONES}
        WHERE name = ?
        ORDER BY addedAt ASC
      `);
      
      const results = stmt.all(normalizedName) as any[];
      
      if (results.length === 0) {
        return null;
      }

      return results.map(r => r.phone);
    } catch (error) {
      console.error(`❌ [JNT PHONES DB] Error getting phones by name:`, error);
      throw error;
    }
  }

  /**
   * Get all phone entries grouped by name
   */
  async getAllGroupedByName(): Promise<Map<string, string[]>> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`
        SELECT name, phone FROM ${DB_NAMES.JNT_PHONES}
        ORDER BY name ASC, addedAt ASC
      `);
      
      const results = stmt.all() as Array<{ name: string; phone: string }>;
      const grouped = new Map<string, string[]>();

      for (const row of results) {
        if (!grouped.has(row.name)) {
          grouped.set(row.name, []);
        }
        const phones = grouped.get(row.name);
        if (phones) {
          phones.push(row.phone);
        }
      }

      return grouped;
    } catch (error) {
      console.error(`❌ [JNT PHONES DB] Error getting all phones:`, error);
      throw error;
    }
  }

  /**
   * Get all phone entries as flat array
   */
  async getAllPhones(): Promise<string[]> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`
        SELECT DISTINCT phone FROM ${DB_NAMES.JNT_PHONES}
        ORDER BY addedAt ASC
      `);
      
      const results = stmt.all() as Array<{ phone: string }>;
      return results.map(r => r.phone);
    } catch (error) {
      console.error(`❌ [JNT PHONES DB] Error getting all phones:`, error);
      throw error;
    }
  }

  /**
   * Remove a phone entry
   */
  async removeEntry(name: string, phone: string): Promise<boolean> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const normalizedName = name.trim().toLowerCase().replaceAll(/\s+/, '');
      const stmt = this.db.prepare(`
        DELETE FROM ${DB_NAMES.JNT_PHONES}
        WHERE name = ? AND phone = ?
      `);

      const result = stmt.run(normalizedName, phone) as any;
      const removed = result.changes > 0;

      if (removed) {
        console.log(`✅ [JNT PHONES DB] Removed phone: ${phone} from name: ${name}`);
      }

      return removed;
    } catch (error) {
      console.error(`❌ [JNT PHONES DB] Error removing entry:`, error);
      throw error;
    }
  }

  /**
   * Remove all phones for a specific name
   */
  async removeByName(name: string): Promise<number> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const normalizedName = name.trim().toLowerCase().replaceAll(/\s+/, '');
      const stmt = this.db.prepare(`
        DELETE FROM ${DB_NAMES.JNT_PHONES}
        WHERE name = ?
      `);

      const result = stmt.run(normalizedName) as any;
      const count = result.changes;

      if (count > 0) {
        console.log(`✅ [JNT PHONES DB] Removed ${count} phones from name: ${name}`);
      }

      return count;
    } catch (error) {
      console.error(`❌ [JNT PHONES DB] Error removing by name:`, error);
      throw error;
    }
  }

  /**
   * Clear all phone entries
   */
  async clear(): Promise<number> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`DELETE FROM ${DB_NAMES.JNT_PHONES}`);
      const result = stmt.run() as any;
      console.log(`✅ [JNT PHONES DB] Cleared ${result.changes} entries`);
      return result.changes;
    } catch (error) {
      console.error(`❌ [JNT PHONES DB] Error clearing database:`, error);
      throw error;
    }
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{ totalPhones: number; totalNames: number }> {
    if (!this.initialized) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const phoneCount = this.db.prepare(`SELECT COUNT(*) as count FROM ${DB_NAMES.JNT_PHONES}`).get() as any;
      const nameCount = this.db.prepare(`SELECT COUNT(DISTINCT name) as count FROM ${DB_NAMES.JNT_PHONES}`).get() as any;

      return {
        totalPhones: phoneCount.count,
        totalNames: nameCount.count
      };
    } catch (error) {
      console.error(`❌ [JNT PHONES DB] Error getting stats:`, error);
      throw error;
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
        console.log(`✅ [JNT PHONES DB] Database closed`);
      } catch (error) {
        console.error(`❌ [JNT PHONES DB] Error closing database:`, error);
        throw error;
      }
    }
  }
}

// Export singleton instance
export const jntPhonesDb = new JNTPhonesDb();
