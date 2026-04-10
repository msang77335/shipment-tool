/**
 * JNT Phone Manager - Manages a pool of phone numbers for JNT tracking
 * Supports: add phones, list phones
 */

import { replace } from "lodash";
import { proxyManager } from "../proxy";
import { PhoneBruteForceFinder } from "./scanPhone";

export interface JNTPhoneInfo {
  phones: string[];
  name: string;
}

class JNTPhoneManager {
  private phones: { [name: string]: string[] } = {};

  /**
   * Get all current phone numbers
   */
  getAllPhones(): JNTPhoneInfo[] {
    return Object.entries(this.phones).map(([name, phones]) => ({
      name,
      phones
    }));
  }

  getPhonesByName(name: string): string[] | null {
    const normalizedName = replace(name.trim().toLowerCase(), /\s+/g, '').trim();
    return this.phones[normalizedName] || null;
  }

  /**
   * Add a single phone number to the pool
   */
  addPhone(phone: string, name: string): JNTPhoneInfo {
    // Validate phone format
    if (!phone || phone.trim().length === 0) {
      throw new Error('Phone number cannot be empty');
    }
    // Validate name
    if (!name || name.trim().length === 0) {
      throw new Error('Name cannot be empty');
    }

    const normalizedName = replace(name.trim().toLowerCase(), /\s+/g, '').trim();

    // Check if phone already exists in this name group
    if (!this.phones[normalizedName]) {
      this.phones[normalizedName] = [];
    }

    // Avoid duplicates within the same name group
    if (this.phones[normalizedName].includes(phone)) {
      console.warn(`⚠️ [JNT PHONE] Phone ${phone} already exists under name: ${name}`);
      return { name, phones: this.phones[normalizedName] };
    }

    this.phones[normalizedName].push(phone);
    console.log(`✅ [JNT PHONE] Added phone: ${phone} under name: ${name} (Total: ${this.phones[normalizedName].length})`);

    return { name, phones: this.phones[normalizedName] };
  }

  /**
   * Add multiple phone numbers to the pool
   */
  addPhones(phoneInfo: JNTPhoneInfo[]): JNTPhoneInfo[] {
    const addedPhones: JNTPhoneInfo[] = [];
    const errors: Array<{ entry: JNTPhoneInfo; error: string }> = [];

    for (const phoneData of phoneInfo) {
      try {
        // Handle both single phone and multiple phones in the entry
        const phonesToAdd = Array.isArray(phoneData.phones) ? phoneData.phones : [phoneData.phones];

        for (const phone of phonesToAdd) {
          const result = this.addPhone(phone, phoneData.name);

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

    const totalNames = Object.keys(this.phones).length;
    console.log(`📱 [JNT PHONE] Added ${addedPhones.length} name groups, total names: ${totalNames}`);

    if (errors.length > 0) {
      console.warn(`⚠️ [JNT PHONE] ${errors.length} entries failed to add`);
    }

    return addedPhones;
  }

  async scanPhone(codes: string): Promise<{ phone: string; status: string }> {
    try {
      const phones = this.getAllPhones().flatMap(info => info.phones);
      const proxies = proxyManager.getAllProxies();
      if(proxies.length === 0) {
        console.warn('⚠️ [JNT PHONE] No proxies available for scanning');
        return {
          phone: '',
          status: 'error: no proxies available'
        }
      }
      const phoneBruteForceFinder = new PhoneBruteForceFinder();

      const phonesResult = await phoneBruteForceFinder.findPhone(codes, phones);

      if (phonesResult.validPhones) {
        console.log(`   ✅ Valid phones found: ${phonesResult.validPhones}`);
        return {
          phone: phonesResult.validPhones,
          status: 'success'
        };
      } else {
        console.log(`   ❌ No valid phones found for code: ${codes}`);
        return {
          phone: '',
          status: 'not found'
        };
      }      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ [JNT PHONE] Error in scanPhone: ${errorMsg}`);
      return {
        phone: '',
        status: `error: ${errorMsg}`
      };
    } 
  }
}

// Export singleton instance
export const phoneManager = new JNTPhoneManager();

// Export class for testing
export { JNTPhoneManager };
