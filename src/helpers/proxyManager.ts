/**
 * Proxy Manager - Manages proxy pool dynamically with integrated blacklist tracking
 * Supports: add proxy, remove proxy, remove proxies by blacklist
 * Tracks blocking issues (quota exceeded, IP blocks, etc.)
 */

import { env } from './env';
import { PlaywrightBrowserSingleton } from './PlaywrightBrowserSingleton';

export interface ProxyInfo {
  server: string;
  username?: string;
  password?: string;
  bypass?: string;
}

interface BlacklistEntry {
  provider: string;
  proxyServer?: string;
  reason: 'QUOTA_EXCEEDED' | 'IP_BLOCKED' | 'RATE_LIMITED' | 'OTHER';
  timestamp: number;
  code?: string;
  expiresIn?: number;
}

interface GrayListEntry {
  provider: string;
  proxyServer?: string;
  tries: number;
  lastAttempt: number;
  reason: 'NO_TRACKING_DATA' | 'OTHER';
}

class ProxyManager {
  private proxies: ProxyInfo[] = [];
  private blacklist: Map<string, BlacklistEntry> = new Map();
  private graylist: Map<string, GrayListEntry> = new Map();
  private readonly BLACKLIST_EXPIRY_TIME = 60 * 60 * 1000; // 1 hour in milliseconds

  constructor() {
    // Initialize with proxies from environment
    this.proxies = [...env.proxies];
    console.log(`📋 [PROXY MANAGER] Initialized with ${this.proxies.length} proxies`);
  }

  /**
   * Get all current proxies
   */
  getAllProxies(): ProxyInfo[] {
    return [...this.proxies];
  }

  /**
   * Get total number of proxies
   */
  getProxyCount(): number {
    return this.proxies.length;
  }

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
    const key = this.getBlacklistKey(provider, proxyServer);
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
    const key = this.getBlacklistKey(provider, proxyServer);
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
    const key = this.getBlacklistKey(provider, proxyServer);
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
          expiresIn: Math.ceil((this.BLACKLIST_EXPIRY_TIME - age) / 1000)
        });
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
      stats.byReason[entry.reason] = (stats.byReason[entry.reason] || 0) + 1;
      stats.byProvider[entry.provider] = (stats.byProvider[entry.provider] || 0) + 1;
    });

    return stats;
  }

  /**
   * Generate unique key for blacklist entry
   */
  private getBlacklistKey(provider: string, proxyServer?: string): string {
    return proxyServer ? `${provider}:${proxyServer}` : provider;
  }

  /**
   * Add a new proxy to the pool
   */
  addProxy(proxyInfo: ProxyInfo): { success: boolean; message: string; totalProxies: number } {
    // Validate proxy format
    if (!proxyInfo.server) {
      return {
        success: false,
        message: 'Proxy server URL is required',
        totalProxies: this.proxies.length
      };
    }

    // Check if proxy already exists
    const exists = this.proxies.some(p => p.server === proxyInfo.server);
    if (exists) {
      return {
        success: false,
        message: `Proxy ${proxyInfo.server} already exists`,
        totalProxies: this.proxies.length
      };
    }

    // Add proxy
    this.proxies.push(proxyInfo);
    const auth = proxyInfo.username ? ` (${proxyInfo.username})` : '';
    console.log(`✅ [PROXY MANAGER] Added proxy: ${proxyInfo.server}${auth}`);

    return {
      success: true,
      message: `Proxy ${proxyInfo.server} added successfully`,
      totalProxies: this.proxies.length
    };
  }

  /**
   * Remove a proxy from the pool
   */
  async removeProxy(proxyServer: string): Promise<{ success: boolean; message: string; totalProxies: number }> {
    const index = this.proxies.findIndex(p => p.server === proxyServer);

    if (index === -1) {
      return {
        success: false,
        message: `Proxy ${proxyServer} not found`,
        totalProxies: this.proxies.length
      };
    }

    // Close all browser contexts/instances for this proxy
    console.log(`🔌 [PROXY MANAGER] Closing browser instances for proxy: ${proxyServer}`);
    await PlaywrightBrowserSingleton.closeContextForProxy(proxyServer);

    // Remove from proxy list
    this.proxies.splice(index, 1);
    console.log(`✅ [PROXY MANAGER] Removed proxy: ${proxyServer}`);

    return {
      success: true,
      message: `Proxy ${proxyServer} removed successfully`,
      totalProxies: this.proxies.length
    };
  }

  /**
   * Remove all proxies that are currently in the blacklist
   */
  async removeBlacklistedProxies(): Promise<{
    success: boolean;
    message: string;
    removed: ProxyInfo[];
    remaining: number;
  }> {
    const blacklist = this.getBlacklist();
    const blacklistedProxyServers = new Set<string>();

    // Collect all blacklisted proxy servers
    blacklist.forEach(entry => {
      if (entry.proxyServer && entry.proxyServer !== 'N/A') {
        blacklistedProxyServers.add(entry.proxyServer);
      }
    });

    const removed: ProxyInfo[] = [];

    // Remove each blacklisted proxy
    for (const proxyServer of blacklistedProxyServers) {
      const proxy = this.proxies.find(p => p.server === proxyServer);
      if (proxy) {
        await this.removeProxy(proxyServer);
        removed.push(proxy);
      }
    }

    console.log(`✅ [PROXY MANAGER] Removed ${removed.length} blacklisted proxies`);

    return {
      success: true,
      message: `Removed ${removed.length} blacklisted proxies`,
      removed,
      remaining: this.proxies.length
    };
  }

  /**
   * Get proxies that are currently blacklisted
   */
  getBlacklistedProxies(): ProxyInfo[] {
    const blacklist = this.getBlacklist();
    const blacklistedProxyServers = new Set<string>();

    // Collect all blacklisted proxy servers
    blacklist.forEach(entry => {
      if (entry.proxyServer && entry.proxyServer !== 'N/A') {
        blacklistedProxyServers.add(entry.proxyServer);
      }
    });

    // Filter proxies that are in blacklist
    return this.proxies.filter(p => blacklistedProxyServers.has(p.server));
  }

  /**
   * Update a proxy
   */
  updateProxy(
    proxyServer: string,
    updates: Partial<ProxyInfo>
  ): { success: boolean; message: string; proxy?: ProxyInfo } {
    const proxy = this.proxies.find(p => p.server === proxyServer);

    if (!proxy) {
      return {
        success: false,
        message: `Proxy ${proxyServer} not found`
      };
    }

    // Update fields
    Object.assign(proxy, updates);
    console.log(`✅ [PROXY MANAGER] Updated proxy: ${proxyServer}`);

    return {
      success: true,
      message: `Proxy ${proxyServer} updated successfully`,
      proxy
    };
  }

  /**
   * Get proxy by server URL
   */
  getProxyByServer(proxyServer: string): ProxyInfo | undefined {
    return this.proxies.find(p => p.server === proxyServer);
  }

  /**
   * Check if a proxy exists
   */
  proxyExists(proxyServer: string): boolean {
    return this.proxies.some(p => p.server === proxyServer);
  }

  /**
   * Get proxy statistics
   */
  getProxyStats(): {
    total: number;
    blacklisted: number;
    active: number;
  } {
    const blacklistedProxies = this.getBlacklistedProxies();

    return {
      total: this.proxies.length,
      blacklisted: blacklistedProxies.length,
      active: this.proxies.length - blacklistedProxies.length
    };
  }

  /**
   * Add an entry to the gray list (no tracking data found)
   */
  addToGrayList({
    provider,
    proxyServer,
    reason = 'NO_TRACKING_DATA'
  }: {
    provider: string;
    proxyServer?: string;
    reason?: 'NO_TRACKING_DATA' | 'OTHER';
  }): void {
    const key = this.getGrayListKey(provider, proxyServer);
    const existingEntry = this.graylist.get(key);

    if (existingEntry) {
      // Increment tries
      existingEntry.tries += 1;
      existingEntry.lastAttempt = Date.now();
      const proxyInfo = proxyServer ? ` (${proxyServer})` : '';
      console.log(`⚠️ [GRAYLIST] Updated ${provider}${proxyInfo} - Tries: ${existingEntry.tries}`);
    } else {
      // Create new entry
      const entry: GrayListEntry = {
        provider,
        proxyServer,
        tries: 1,
        lastAttempt: Date.now(),
        reason
      };
      this.graylist.set(key, entry);
      const proxyInfo = proxyServer ? ` (${proxyServer})` : '';
      console.log(`⚠️ [GRAYLIST] Added ${provider}${proxyInfo} - Reason: ${reason}`);
    }
  }

  /**
   * Get all current gray list entries
   */
  getGrayList(): GrayListEntry[] {
    return Array.from(this.graylist.values());
  }

  /**
   * Get gray list statistics
   */
  getGrayListStats(): {
    totalEntries: number;
    byProvider: Record<string, { count: number; totalTries: number }>;
    highestTries: {
      provider: string;
      proxyServer?: string;
      tries: number;
    } | null;
  } {
    const entries = this.getGrayList();
    const stats = {
      totalEntries: entries.length,
      byProvider: {} as Record<string, { count: number; totalTries: number }>,
      highestTries: null as { provider: string; proxyServer?: string; tries: number } | null
    };

    let maxTries = 0;

    entries.forEach(entry => {
      // Count by provider
      if (!stats.byProvider[entry.provider]) {
        stats.byProvider[entry.provider] = { count: 0, totalTries: 0 };
      }
      stats.byProvider[entry.provider].count += 1;
      stats.byProvider[entry.provider].totalTries += entry.tries;

      // Track highest tries
      if (entry.tries > maxTries) {
        maxTries = entry.tries;
        stats.highestTries = {
          provider: entry.provider,
          proxyServer: entry.proxyServer,
          tries: entry.tries
        };
      }
    });

    return stats;
  }

  /**
   * Clear all gray list entries
   */
  clearGrayList(): void {
    const count = this.graylist.size;
    this.graylist.clear();
    console.log(`🗑️  [GRAYLIST] Cleared all ${count} entries`);
  }

  /**
   * Remove a specific entry from gray list
   */
  removeFromGrayList(provider: string, proxyServer?: string): void {
    const key = this.getGrayListKey(provider, proxyServer);
    if (this.graylist.delete(key)) {
      const proxyInfo = proxyServer ? ` (${proxyServer})` : '';
      console.log(`✅ [GRAYLIST] Removed ${provider}${proxyInfo} from gray list`);
    }
  }

  /**
   * Generate unique key for gray list entry
   */
  private getGrayListKey(provider: string, proxyServer?: string): string {
    return proxyServer ? `${provider}:${proxyServer}` : provider;
  }
}

// Singleton instance
export const proxyManager = new ProxyManager();
