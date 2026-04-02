/**
 * Proxy Manager - Manages proxy pool dynamically with integrated blacklist tracking
 * Supports: add proxy, remove proxy, remove proxies by blacklist
 * Tracks blocking issues (quota exceeded, IP blocks, etc.)
 * Supports loading proxies from Webshare API (with full pagination)
 */

import { env } from './env';
import { PlaywrightBrowserSingleton } from './PlaywrightBrowserSingleton';

// ---------------------------------------------------------------------------
// Webshare API types
// ---------------------------------------------------------------------------
interface WebshareProxy {
  id: string;
  username: string;
  password: string;
  proxy_address: string;
  port: number;
  valid: boolean;
}

interface WebshareListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: WebshareProxy[];
}

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
   * Replace proxies in the pool by calling Webshare API and reloading the proxy list
   * This method handles IP addresses that need replacement and fetches new proxies
   *
   * @param ipAddresses - Array of IP addresses to replace
   * @param replaceCount - Number of new proxies to get (default: 2)
   * @param dryRun - If true, performs a dry run without actual replacement (default: false)
   * @returns Success status, removed proxies, and reloaded proxies count
   */
  async replaceProxiesAndReload(
    ipAddresses: string[],
    dryRun: boolean = false
  ): Promise<{
    success: boolean;
    message: string;
    webshareResponse?: Record<string, unknown>;
    removedProxies: ProxyInfo[];
    newProxies: ProxyInfo[];
    reloadedCount: number;
    totalProxies: number;
    error?: string;
  }> {
    if (!ipAddresses || ipAddresses.length === 0) {
      return {
        success: false,
        message: 'No IP addresses provided for replacement',
        removedProxies: [],
        newProxies: [],
        reloadedCount: 0,
        totalProxies: this.proxies.length,
        error: 'Empty IP list'
      };
    }

    const replaceCount = ipAddresses.length; // Replace one proxy per IP address
    // Step 1: Call Webshare API to replace proxies
    const webshareResult = await this.replaceProxies(ipAddresses, replaceCount, dryRun);

    if (!webshareResult.success) {
      return {
        success: false,
        message: `Webshare API replacement failed: ${webshareResult.message}`,
        removedProxies: [],
        newProxies: [],
        reloadedCount: 0,
        totalProxies: this.proxies.length,
        error: webshareResult.error
      };
    }

    // Step 2: Remove proxies that have these IP addresses from local pool
    const removedProxies: ProxyInfo[] = [];

    // Extract IP addresses from proxy servers (e.g., "http://1.2.3.4:8080" -> "1.2.3.4")
    for (const ip of ipAddresses) {
      const index = this.proxies.findIndex(p => p.server.includes(ip));
      if (index !== -1) {
        const removed = this.proxies[index];
        removedProxies.push(removed);

        // Close browser contexts for this proxy
        console.log(`🔌 [PROXY MANAGER] Closing browser instances for IP: ${ip}`);
        await PlaywrightBrowserSingleton.closeContextForProxy(removed.server);

        // Remove from list
        this.proxies.splice(index, 1);
        console.log(`✅ [PROXY MANAGER] Removed proxy with IP: ${ip}`);
      }
    }

    // Step 3: Reload proxies from Webshare (only if not a dry run)
    let newProxies: ProxyInfo[] = [];
    let reloadedCount = 0;
    if (!dryRun) {
      const proxiesBeforeReload = this.proxies.length;
      const loadResult = await this.loadFromWebshare();
      reloadedCount = loadResult.loaded;
      
      // Capture newly added proxies
      newProxies = this.proxies.slice(proxiesBeforeReload);
      
      console.log(`🔄 [PROXY MANAGER] Reloaded ${reloadedCount} new proxies from Webshare`);
    }

    return {
      success: true,
      message: `Successfully replaced ${ipAddresses.length} proxies via Webshare API${dryRun ? ' (dry run)' : ''}`,
      webshareResponse: webshareResult.response,
      removedProxies,
      newProxies,
      reloadedCount,
      totalProxies: this.proxies.length
    };
  }

  /**
   * Replace a proxy in the pool (remove old, add new)
   * Removes a proxy by server address and adds a new one
   * Closes browser contexts for the removed proxy
   */
  async replaceProxy(
    oldProxyServer: string,
    newProxyInfo: ProxyInfo
  ): Promise<{
    success: boolean;
    message: string;
    removed?: ProxyInfo;
    added?: ProxyInfo;
    totalProxies: number;
  }> {
    // Find and remove old proxy
    const index = this.proxies.findIndex(p => p.server === oldProxyServer);
    if (index === -1) {
      return {
        success: false,
        message: `Proxy ${oldProxyServer} not found`,
        totalProxies: this.proxies.length
      };
    }

    const removedProxy = this.proxies[index];

    // Close browser contexts for old proxy
    console.log(`🔌 [PROXY MANAGER] Closing browser instances for proxy: ${oldProxyServer}`);
    await PlaywrightBrowserSingleton.closeContextForProxy(oldProxyServer);

    // Remove from list
    this.proxies.splice(index, 1);
    console.log(`✅ [PROXY MANAGER] Removed proxy: ${oldProxyServer}`);

    // Add new proxy
    if (!newProxyInfo.server) {
      return {
        success: false,
        message: 'New proxy server URL is required',
        removed: removedProxy,
        totalProxies: this.proxies.length
      };
    }

    // Check if new proxy already exists
    const exists = this.proxies.some(p => p.server === newProxyInfo.server);
    if (exists) {
      return {
        success: false,
        message: `New proxy ${newProxyInfo.server} already exists`,
        removed: removedProxy,
        totalProxies: this.proxies.length
      };
    }

    // Add new proxy
    this.proxies.push(newProxyInfo);
    const auth = newProxyInfo.username ? ` (${newProxyInfo.username})` : '';
    console.log(`✅ [PROXY MANAGER] Added proxy: ${newProxyInfo.server}${auth}`);

    return {
      success: true,
      message: `Proxy replaced: ${oldProxyServer} → ${newProxyInfo.server}`,
      removed: removedProxy,
      added: newProxyInfo,
      totalProxies: this.proxies.length
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

  // -------------------------------------------------------------------------
  // Webshare API integration
  // -------------------------------------------------------------------------

  /**
   * Fetch all proxies from the Webshare API (handles pagination automatically).
   * Replaces the entire proxy pool with the fetched list.
   * Only proxies with `valid: true` are loaded.
   *
   * Environment variables:
   *   WEBSHARE_API_KEY   – Bearer token for Webshare API (required)
   *   WEBSHARE_PROXY_MODE – `direct` | `backbone` etc. (default: "direct")
   */
  async loadFromWebshare(): Promise<{ loaded: number; skipped: number }> {
    const apiKey = env.webshareApiKey;
    if (!apiKey) {
      console.warn('⚠️  [WEBSHARE] WEBSHARE_API_KEY is not set – skipping load');
      return { loaded: 0, skipped: 0 };
    }

    const mode = env.webshareProxyMode;
    const pageSize = 100;
    let page = 1;
    let totalLoaded = 0;
    let totalSkipped = 0;
    const fetched: ProxyInfo[] = [];

    console.log(`🌐 [WEBSHARE] Fetching proxy list (mode=${mode}) …`);

    // biome-ignore lint/suspicious/noConstantCondition: pagination loop
    while (true) {
      const url = `https://proxy.webshare.io/api/v2/proxy/list/?mode=${encodeURIComponent(mode)}&page=${page}&page_size=${pageSize}`;

      let response: Response;
      try {
        response = await fetch(url, {
          headers: { Authorization: `Token ${apiKey}` },
        });
      } catch (err) {
        console.error(`❌ [WEBSHARE] Network error on page ${page}:`, err);
        break;
      }

      if (!response.ok) {
        console.error(
          `❌ [WEBSHARE] API returned HTTP ${response.status} on page ${page}`
        );
        break;
      }

      const data = await response.json() as WebshareListResponse;

      for (const p of data.results) {
        if (!p.valid) {
          totalSkipped++;
          continue;
        }
        fetched.push({
          server: `http://${p.proxy_address}:${p.port}`,
          username: p.username,
          password: p.password,
        });
        totalLoaded++;
      }

      console.log(
        `   [WEBSHARE] Page ${page}: ${data.results.length} entries, ${data.results.filter(r => r.valid).length} valid`
      );

      if (!data.next) break;
      page++;
    }

    // Replace pool atomically
    this.proxies = fetched;
    console.log(
      `✅ [WEBSHARE] Loaded ${totalLoaded} proxies (${totalSkipped} invalid/skipped). Pool size: ${this.proxies.length}`
    );

    return { loaded: totalLoaded, skipped: totalSkipped };
  }

  /**
   * Initialize Webshare proxies on startup if WEBSHARE_API_KEY is configured.
   * Falls back to the static PROXY_LIST if the API key is absent.
   */
  async initializeWebshare(): Promise<void> {
    if (!env.webshareApiKey) return;
    await this.loadFromWebshare();
  }

  /**
   * Replace proxies in Webshare API by IP addresses
   *
   * @param ipAddresses - Array of IP addresses to replace
   * @param replaceCount - Number of proxies to replace with (default: 2)
   * @param dryRun - If true, performs a dry run without actual replacement (default: false)
   * @returns Success status and API response
   */
  async replaceProxies(
    ipAddresses: string[],
    replaceCount: number = 2,
    dryRun: boolean = false
  ): Promise<{
    success: boolean;
    message: string;
    response?: Record<string, unknown>;
    error?: string;
  }> {
    const apiKey = env.webshareApiKey;
    if (!apiKey) {
      return {
        success: false,
        message: 'WEBSHARE_API_KEY is not configured',
        error: 'Missing API key'
      };
    }

    if (!ipAddresses || ipAddresses.length === 0) {
      return {
        success: false,
        message: 'No IP addresses provided for replacement',
        error: 'Empty IP list'
      };
    }

    const url = 'https://proxy.webshare.io/api/v2/proxy/replace/';
    const payload = {
      to_replace: {
        type: 'ip_address',
        ip_addresses: ipAddresses
      },
      replace_with: [
        {
          type: 'any',
          count: replaceCount
        }
      ],
      dry_run: dryRun
    };

    try {
      console.log(
        `🔄 [WEBSHARE] Replacing ${ipAddresses.length} proxies (dry_run: ${dryRun}) …`
      );

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json() as Record<string, unknown>;

      if (!response.ok) {
        console.error(
          `❌ [WEBSHARE] Proxy replacement failed with HTTP ${response.status}`
        );
        return {
          success: false,
          message: `Proxy replacement failed with status ${response.status}`,
          error: JSON.stringify(responseData),
          response: responseData
        };
      }

      console.log(`✅ [WEBSHARE] Proxy replacement ${dryRun ? '(dry run) ' : ''}completed successfully`);
      console.log(`   Response:`, JSON.stringify(responseData, null, 2));

      return {
        success: true,
        message: `Successfully replaced ${ipAddresses.length} proxies`,
        response: responseData
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`❌ [WEBSHARE] Proxy replacement error:`, err);
      return {
        success: false,
        message: 'Proxy replacement request failed',
        error: errorMessage
      };
    }
  }
}

// Singleton instance
export const proxyManager = new ProxyManager();
