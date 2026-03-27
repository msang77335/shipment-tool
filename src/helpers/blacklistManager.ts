/**
 * Blacklist Manager - Tracks blocking issues (quota exceeded, IP blocks, etc.)
 * Stores information about providers/proxies that have blocking issues
 */

interface BlacklistEntry {
  provider: string;
  proxyServer?: string;
  reason: 'QUOTA_EXCEEDED' | 'IP_BLOCKED' | 'RATE_LIMITED' | 'OTHER';
  timestamp: number;
  code?: string; // Tracking code that triggered the issue
}

class BlacklistManager {
  private blacklist: Map<string, BlacklistEntry> = new Map();
  private readonly BLACKLIST_EXPIRY_TIME = 60 * 60 * 1000; // 1 hour in milliseconds

  /**
   * Add an entry to the blacklist
   */
  addToBlacklist({
    provider,
    proxyServer,
    reason,
    code
  }: {
    provider: string;
    proxyServer?: string;
    reason: 'QUOTA_EXCEEDED' | 'IP_BLOCKED' | 'RATE_LIMITED' | 'OTHER';
    code?: string;
  }): void {
    const key = this.getKey(provider, proxyServer);
    const entry: BlacklistEntry = {
      provider,
      proxyServer,
      reason,
      timestamp: Date.now(),
      code
    };

    this.blacklist.set(key, entry);
    const proxyInfo = proxyServer ? ` (${proxyServer})` : '';
    console.log(`🚫 [BLACKLIST] Added ${provider}${proxyInfo} - Reason: ${reason}`);
  }

  /**
   * Check if provider/proxy is blacklisted
   */
  isBlacklisted(provider: string, proxyServer?: string): {
    isBlacklisted: boolean;
    entry?: BlacklistEntry;
  } {
    const key = this.getKey(provider, proxyServer);
    const entry = this.blacklist.get(key);

    if (!entry) {
      return { isBlacklisted: false };
    }

    // Check if entry has expired
    const age = Date.now() - entry.timestamp;
    if (age > this.BLACKLIST_EXPIRY_TIME) {
      this.blacklist.delete(key);
      const proxyInfo = proxyServer ? ` (${proxyServer})` : '';
      console.log(`⏰ [BLACKLIST] Removed expired entry for ${provider}${proxyInfo}`);
      return { isBlacklisted: false };
    }

    return { isBlacklisted: true, entry };
  }

  /**
   * Remove from blacklist
   */
  removeFromBlacklist(provider: string, proxyServer?: string): void {
    const key = this.getKey(provider, proxyServer);
    if (this.blacklist.delete(key)) {
      const proxyInfo = proxyServer ? ` (${proxyServer})` : '';
      console.log(`✅ [BLACKLIST] Removed ${provider}${proxyInfo} from blacklist`);
    }
  }

  /**
   * Get all current blacklist entries
   */
  getBlacklist(): BlacklistEntry[] {
    const now = Date.now();
    const validEntries: BlacklistEntry[] = [];

    for (const [key, entry] of this.blacklist.entries()) {
      const age = now - entry.timestamp;
      if (age > this.BLACKLIST_EXPIRY_TIME) {
        this.blacklist.delete(key);
      } else {
        validEntries.push({
          ...entry,
          // Add age in seconds to response
          expiresIn: Math.ceil((this.BLACKLIST_EXPIRY_TIME - age) / 1000)
        } as BlacklistEntry & { expiresIn: number });
      }
    }

    return validEntries;
  }

  /**
   * Clear all blacklist entries
   */
  clearBlacklist(): void {
    const count = this.blacklist.size;
    this.blacklist.clear();
    console.log(`🗑️  [BLACKLIST] Cleared all ${count} entries`);
  }

  /**
   * Get statistics about blacklist
   */
  getBlacklistStats(): {
    totalEntries: number;
    byReason: Record<string, number>;
    byProvider: Record<string, number>;
  } {
    const entries = this.getBlacklist();
    
    const stats = {
      totalEntries: entries.length,
      byReason: {} as Record<string, number>,
      byProvider: {} as Record<string, number>
    };

    entries.forEach(entry => {
      // Count by reason
      stats.byReason[entry.reason] = (stats.byReason[entry.reason] || 0) + 1;
      // Count by provider
      stats.byProvider[entry.provider] = (stats.byProvider[entry.provider] || 0) + 1;
    });

    return stats;
  }

  /**
   * Generate unique key for blacklist entry
   */
  private getKey(provider: string, proxyServer?: string): string {
    return proxyServer ? `${provider}:${proxyServer}` : provider;
  }
}

// Singleton instance
export const blacklistManager = new BlacklistManager();
