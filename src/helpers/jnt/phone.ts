/**
 * JNT Phone Manager - Manages a pool of phone numbers for JNT tracking
 * Supports: add phones, list phones
 * Backend: SQLite database for persistent storage
 */

import { replace } from "lodash";
import { jntPhonesDb } from "../../database/jntPhones";

export interface JNTPhoneInfo {
  phones: string[];
  name: string;
}

class JNTPhoneManager {
  private initialized: boolean = false;

  /**
   * Initialize database on first use
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await jntPhonesDb.initialize();
      this.initialized = true;
    }
  }

  /**
   * Get all current phone numbers grouped by name
   */
  async getAllPhones(): Promise<JNTPhoneInfo[]> {
    await this.ensureInitialized();
    const grouped = await jntPhonesDb.getAllGroupedByName();

    return Array.from(grouped.entries()).map(([name, phones]) => ({
      name,
      phones
    }));
  }

  /**
   * Get phones by name
   */
  async getPhonesByName(name: string): Promise<string[] | null> {
    await this.ensureInitialized();
    const normalizedName = replace(name.trim().toLowerCase(), /\s+/g, '').trim();
    return await jntPhonesDb.getPhonesByName(normalizedName);
  }

  /**
   * Add a single phone number to the pool
   */
  async addPhone(phone: string, name: string): Promise<JNTPhoneInfo> {
    await this.ensureInitialized();

    // Validate phone format
    if (!phone || phone.trim().length === 0) {
      throw new Error('Phone number cannot be empty');
    }
    // Validate name
    if (!name || name.trim().length === 0) {
      throw new Error('Name cannot be empty');
    }

    const normalizedName = replace(name.trim().toLowerCase(), /\s+/g, '').trim();

    await jntPhonesDb.addEntry(normalizedName, phone);

    const phones = await jntPhonesDb.getPhonesByName(normalizedName);
    console.log(`✅ [JNT PHONE] Added phone: ${phone} under name: ${name} (Total: ${phones?.length || 0})`);

    return { name, phones: phones || [] };
  }

  /**
   * Add multiple phone numbers to the pool
   */
  async addPhones(phoneInfo: JNTPhoneInfo[]): Promise<JNTPhoneInfo[]> {
    await this.ensureInitialized();

    const addedPhones: JNTPhoneInfo[] = [];
    const errors: Array<{ entry: JNTPhoneInfo; error: string }> = [];

    for (const phoneData of phoneInfo) {
      try {
        // Handle both single phone and multiple phones in the entry
        const phonesToAdd = Array.isArray(phoneData.phones) ? phoneData.phones : [phoneData.phones];

        for (const phone of phonesToAdd) {
          const result = await this.addPhone(phone, phoneData.name);

          // Track the result only once per name (to avoid duplicates in response)
          if (!addedPhones.some(p => p.name === result.name)) {
            addedPhones.push(result);
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ [JNT PHONE] Failed to add phone entry for name "${phoneData.name}": ${errorMsg}`);
        errors.push({ entry: phoneData, error: errorMsg });
      }
    }

    const stats = await jntPhonesDb.getStats();
    console.log(`📱 [JNT PHONE] Added ${addedPhones.length} name groups, total: ${stats.totalPhones} phones in ${stats.totalNames} names`);

    if (errors.length > 0) {
      console.warn(`⚠️ [JNT PHONE] ${errors.length} entries failed to add`);
    }

    return addedPhones;
  }

  /**
   * Export all phones as CSV rows: [seller, phone1, phone2, ...]
   * Each row corresponds to one seller with all their phones spread across columns.
   */
  async exportPhones(): Promise<string[][]> {
    await this.ensureInitialized();
    const allPhones = await this.getAllPhones();

    const rows: string[][] = allPhones.map(({ name, phones }) => [name.toUpperCase(), ...phones]);
    return rows;
  }

  /**
   * Delete all phones by name
   */
  async deletePhonesByName(name: string): Promise<number> {
    await this.ensureInitialized();

    if (!name || name.trim().length === 0) {
      throw new Error('Name cannot be empty');
    }

    const deletedCount = await jntPhonesDb.removeByName(name);
    console.log(`✅ [JNT PHONE] Deleted ${deletedCount} phones for name: ${name}`);
    return deletedCount;
  }
}

// Export singleton instance
export const phoneManager = new JNTPhoneManager();

// Export class for testing
export { JNTPhoneManager };
