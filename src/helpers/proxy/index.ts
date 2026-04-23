/**
 * Proxy Manager - Manages proxy pool dynamically with integrated blacklist tracking
 * Supports: add proxy, remove proxy, remove proxies by blacklist
 * Tracks blocking issues (quota exceeded, IP blocks, etc.)
 * Supports loading proxies from Webshare API (with full pagination)
 * Persists proxies to SQLite database
 */

import { blacklistDb, type BlacklistEntry } from '../../database/blacklist';
import { proxiesDb } from '../../database/proxies';
import { PlaywrightBrowserSingleton } from '../browser/PlaywrightBrowserSingleton';
import { env } from '../env';
import { applyStealthPatches, setStealthHeaders } from '../index';
import { webshareApi, type ProxyInfo } from '../webShare/webshareApi';

export type { BlacklistEntry } from '../../database/blacklist';
export type { ProxyInfo } from '../webShare/webshareApi';

const { firefox } = require('playwright-extra');

class ProxyManager {
  private proxies: ProxyInfo[] = [];
  private initialized: boolean = false;

  constructor() {
    // Initialize with proxies from environment (will be overridden by DB or Webshare)
    this.proxies = [...env.proxies];
    console.log(`📋 [PROXY MANAGER] Initialized with ${this.proxies.length} proxies from environment`);
  }

  /**
   * Load proxies from database on startup
   */
  async loadFromDatabase(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize database
      await proxiesDb.initialize();

      // Load proxies from database
      const dbProxies = await proxiesDb.getAllProxies();

      if (dbProxies.length > 0) {
        // Load blacklist to filter out blacklisted proxies on startup
        await blacklistDb.initialize();
        const blacklistEntries = await blacklistDb.getAll();
        const blacklistedServers = new Set(blacklistEntries.map(e => e.proxyServer).filter(Boolean));

        // Convert ProxyRecord to ProxyInfo, excluding blacklisted proxies
        const allProxies = dbProxies.map(record => ({
          server: record.server,
          username: record.username,
          password: record.password,
          bypass: record.bypass,
        }));

        this.proxies = allProxies.filter(p => !blacklistedServers.has(p.server));

        const skipped = allProxies.length - this.proxies.length;
        console.log(`✅ [PROXY MANAGER] Loaded ${this.proxies.length} proxies from database (skipped ${skipped} blacklisted)`);
      } else {
        console.log(`📝 [PROXY MANAGER] No proxies found in database, using environment defaults`);
      }

      this.initialized = true;
    } catch (error) {
      console.error(`❌ [PROXY MANAGER] Error loading from database:`, error);
      console.log(`⚠️  [PROXY MANAGER] Continuing with environment proxies`);
      this.initialized = true;
    }
  }

  /**
   * Get all current proxies
   */
  getAllProxies(): ProxyInfo[] {
    return [...this.proxies];
  }

  /**
   * Save proxy to database
   */
  private async saveProxyToDB(proxy: ProxyInfo): Promise<void> {
    try {
      await proxiesDb.saveProxy({
        server: proxy.server,
        username: proxy.username,
        password: proxy.password,
        bypass: proxy.bypass,
      });
    } catch (error) {
      console.error(`❌ [PROXY MANAGER] Error saving proxy to DB:`, error);
    }
  }

  /**
   * Remove a proxy from the in-memory pool and close its browser contexts.
   * Does NOT touch the database — use this when the proxy should remain in
   * proxiesDb for replacement lookup (e.g. when blacklisting).
   */
  private async removeFromMemoryPool(proxyServer: string): Promise<void> {
    const index = this.proxies.findIndex(p => p.server === proxyServer);
    if (index === -1) return;
    console.log(`🔌 [PROXY MANAGER] Closing browser instances for proxy: ${proxyServer}`);
    await PlaywrightBrowserSingleton.closeContextForProxy(proxyServer);
    this.proxies.splice(index, 1);
    console.log(`✅ [PROXY MANAGER] Removed proxy from memory pool: ${proxyServer}`);
  }

  /**
   * Remove proxy from database
   */
  private async removeProxyFromDB(server: string): Promise<void> {
    try {
      await proxiesDb.removeProxy(server);
    } catch (error) {
      console.error(`❌ [PROXY MANAGER] Error removing proxy from DB:`, error);
    }
  }

  /**
   * Sync proxies to database.
   * Pass `fullList` to persist ALL proxies (including blacklisted) so they remain
   * discoverable by replaceProxiesAutomatic after a fresh deploy.
   * When `fullList` is omitted, only the active in-memory pool is saved.
   */
  private async syncProxiesToDB(fullList?: ProxyInfo[]): Promise<void> {
    const listToSync = fullList ?? this.proxies;
    try {
      await proxiesDb.clearAllProxies();
      for (const proxy of listToSync) {
        await this.saveProxyToDB(proxy);
      }
    } catch (error) {
      console.error(`❌ [PROXY MANAGER] Error syncing proxies to DB:`, error);
    }
  }

  /**
 * Get proxies that are currently blacklisted
 */
  async getBlacklistedProxies(): Promise<ProxyInfo[]> {
    const blacklist = await this.getBlacklist();
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
 * Get proxy statistics
 */
  async getProxyStats(): Promise<{
    total: number;
    blacklisted: number;
    active: number;
  }> {
    const blacklistedProxies = await this.getBlacklistedProxies();

    return {
      total: this.proxies.length,
      blacklisted: blacklistedProxies.length,
      active: this.proxies.length - blacklistedProxies.length
    };
  }

  /**
   * Add an entry to the blacklist
   */
  async addToBlacklist({
    provider,
    proxyServer,
    reason,
    code
  }: {
    provider: string;
    proxyServer?: string;
    reason: 'QUOTA_EXCEEDED' | 'IP_BLOCKED' | 'RATE_LIMITED' | 'OTHER';
    code?: string;
  }): Promise<void> {
    const entry: BlacklistEntry = {
      provider,
      proxyServer,
      reason,
      timestamp: Date.now(),
      code
    };

    await blacklistDb.addEntry(entry);
    const proxyInfo = proxyServer ? ` (${proxyServer})` : '';
    console.log(`🚫 [BLACKLIST] Added ${provider}${proxyInfo} - Reason: ${reason}`);

    // Remove from in-memory pool only — keep in proxiesDb so replaceProxiesAutomatic
    // can still find this IP when looking up blacklisted proxies to replace.
    if (proxyServer) {
      const inPool = this.proxies.some(p => p.server === proxyServer);
      if (inPool) {
        await this.removeFromMemoryPool(proxyServer);
        console.log(`🗑️ [BLACKLIST] Auto-removed ${proxyServer} from proxy pool`);
      }
    }
  }

  /**
   * Remove from blacklist
   */
  async removeFromBlacklist(provider: string, proxyServer?: string): Promise<void> {
    await blacklistDb.removeEntry(provider, proxyServer);
    const proxyInfo = proxyServer ? ` (${proxyServer})` : '';
    console.log(`✅ [BLACKLIST] Removed ${provider}${proxyInfo} from blacklist`);
  }

  /**
   * Get all current blacklist entries
   */
  async getBlacklist(): Promise<BlacklistEntry[]> {
    return blacklistDb.getAll();
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

    // Remove from database
    await this.removeProxyFromDB(proxyServer);

    return {
      success: true,
      message: `Proxy ${proxyServer} removed successfully`,
      totalProxies: this.proxies.length
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

    // IPs to exclude from replacement
    const excludeIps = new Set(['46.203.157.218', '104.253.212.63']);

    // Call Webshare API to replace proxies
    const webshareResult = await webshareApi.replaceProxies(
      ipAddresses,
      excludeIps,
      replaceCount,
      dryRun
    );

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

        // Remove from database
        await this.removeProxyFromDB(removed.server);

        // Remove from blacklist if exists
        const blacklist = await this.getBlacklist();
        for (const entry of blacklist) {
          if (entry.proxyServer === removed.server) {
            await this.removeFromBlacklist(entry.provider, entry.proxyServer);
            console.log(`🗑️ [PROXY MANAGER] Removed blacklist entry for proxy ${removed.server}`);
          }
        }
      }
    }

    // Step 3: Reload proxies from Webshare (only if not a dry run)
    let newProxies: ProxyInfo[] = [];
    let reloadedCount = 0;
    if (!dryRun) {
      const proxiesBeforeReload = this.proxies.length;
      const loadResult = await webshareApi.loadFromWebshare();
      reloadedCount = loadResult.loaded;

      // Filter blacklisted proxies from the in-memory active pool
      const blacklistEntries = await blacklistDb.getAll();
      const blacklistedServers = new Set(blacklistEntries.map(e => e.proxyServer).filter(Boolean));
      this.proxies = loadResult.proxies.filter(p => !blacklistedServers.has(p.server));

      // Capture newly added proxies
      newProxies = this.proxies.slice(proxiesBeforeReload);

      console.log(`🔄 [PROXY MANAGER] Reloaded ${reloadedCount} new proxies from Webshare (${this.proxies.length} active)`);

      // Save full list to DB so blacklisted IPs remain findable after redeploy
      await this.syncProxiesToDB(loadResult.proxies);
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
   * Initialize Webshare proxies on startup if WEBSHARE_API_KEY is configured.
   * Falls back to the static PROXY_LIST if the API key is absent.
   */
  async initializeWebshare(): Promise<void> {
    const result = await webshareApi.loadFromWebshare();
    if (result.proxies.length > 0) {
      // Filter out blacklisted proxies
      await blacklistDb.initialize();
      const blacklistEntries = await blacklistDb.getAll();
      const blacklistedServers = new Set(blacklistEntries.map(e => e.proxyServer).filter(Boolean));

      const filtered = result.proxies.filter(p => !blacklistedServers.has(p.server));
      const skipped = result.proxies.length - filtered.length;

      this.proxies = filtered;
      console.log(`✅ [PROXY MANAGER] Initialized with ${filtered.length} proxies from Webshare (skipped ${skipped} blacklisted)`);

      // Persist full list (including blacklisted) so replacement logic can find them after redeploy
      await this.syncProxiesToDB(result.proxies);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers for replaceProxiesAutomatic
  // ---------------------------------------------------------------------------

  /**
   * Extract unique IP hostnames from the blacklist, excluding protected IPs
   */
  private async getBlacklistedIps(excludeIps: Set<string>): Promise<string[]> {
    return (await this.getBlacklist())
      .map(entry => {
        if (!entry.proxyServer) return null;
        try { return new URL(entry.proxyServer).hostname; } catch { return null; }
      })
      .filter((ip): ip is string => ip !== null)
      .filter(ip => !excludeIps.has(ip));
  }

  /**
   * Remove blacklist entries for excluded IPs that still appear in Webshare proxies
   */
  private async cleanExcludedBlacklistEntries(excludeIps: Set<string>, webshareProxies: ProxyInfo[]): Promise<void> {
    const hasExcluded = webshareProxies.some(p => {
      try { return excludeIps.has(new URL(p.server).hostname); } catch { return false; }
    });
    if (!hasExcluded) return;

    const blacklist = await this.getBlacklist();
    for (const entry of blacklist) {
      if (!entry.proxyServer) continue;
      try {
        const hostname = new URL(entry.proxyServer).hostname;
        if (excludeIps.has(hostname)) {
          await this.removeFromBlacklist(entry.provider, entry.proxyServer);
          await blacklistDb.removeEntry(entry.provider, entry.proxyServer);
          console.log(`🗑️ [PROXY MANAGER] Removed blacklist entry for excluded IP ${hostname}`);
        }
      } catch { /* Invalid URL, skip */ }
    }
  }

  /**
   * Remove all blacklist entries for a given IP hostname
   */
  private async cleanBlacklistEntriesForIp(ip: string): Promise<string[]> {
    const cleaned: string[] = [];
    const blacklist = await this.getBlacklist();
    for (const entry of blacklist) {
      if (!entry.proxyServer) continue;
      try {
        if (new URL(entry.proxyServer).hostname === ip) {
          await this.removeFromBlacklist(entry.provider, entry.proxyServer);
          await blacklistDb.removeEntry(entry.provider, entry.proxyServer);
          cleaned.push(ip);
          console.log(`🗑️ [PROXY MANAGER] Removed unreachable blacklist entry for IP ${ip}`);
        }
      } catch { /* Invalid URL, skip */ }
    }
    return cleaned;
  }

  /**
   * Find the first blacklisted IP that exists in database; clean up stale entries
   * Checks IP against database proxies, not just memory pool
   */
  private async findValidIpToProcess(blacklistedIps: string[], dbProxyIps: Set<string>): Promise<{
    ipToProcess: string | null;
    cleanedBlacklistIps: string[];
  }> {
    const cleanedBlacklistIps: string[] = [];
    for (const ip of blacklistedIps) {
      if (dbProxyIps.has(ip)) return { ipToProcess: ip, cleanedBlacklistIps };
      console.log(`⚠️  [PROXY MANAGER] Blacklisted IP ${ip} not found in database - removing from blacklist`);
      const cleaned = await this.cleanBlacklistEntriesForIp(ip);
      cleanedBlacklistIps.push(...cleaned);
    }
    return { ipToProcess: null, cleanedBlacklistIps };
  }

  /**
   * Remove proxies by IP from pool, close browser contexts, remove from DB and blacklist
   */
  private async removeProxiesFromPool(ips: string[]): Promise<ProxyInfo[]> {
    const removedProxies: ProxyInfo[] = [];
    for (const ip of ips) {
      const index = this.proxies.findIndex(p => p.server.includes(ip));
      if (index === -1) continue;

      const removed = this.proxies[index];
      removedProxies.push(removed);

      console.log(`🔌 [PROXY MANAGER] Closing browser instances for IP: ${ip}`);
      await PlaywrightBrowserSingleton.closeContextForProxy(removed.server);

      this.proxies.splice(index, 1);
      console.log(`✅ [PROXY MANAGER] Removed proxy with IP: ${ip}`);
      await this.removeProxyFromDB(removed.server);

      const blacklist = await this.getBlacklist();
      for (const entry of blacklist) {
        if (entry.proxyServer === removed.server) {
          await this.removeFromBlacklist(entry.provider, entry.proxyServer);
          console.log(`🗑️ [PROXY MANAGER] Removed blacklist entry for proxy ${removed.server}`);
        }
      }
    }
    return removedProxies;
  }

  /**
   * Reload proxies from Webshare and persist to DB
   */
  private async reloadAndPersistProxies(proxiesBeforeReload: number): Promise<{
    newProxies: ProxyInfo[];
    reloadedCount: number;
  }> {
    const loadResult = await webshareApi.loadFromWebshare();

    // Filter blacklisted proxies from the in-memory active pool
    const blacklistEntries = await blacklistDb.getAll();
    const blacklistedServers = new Set(blacklistEntries.map(e => e.proxyServer).filter(Boolean));
    this.proxies = loadResult.proxies.filter(p => !blacklistedServers.has(p.server));

    const newProxies = this.proxies.slice(proxiesBeforeReload);
    console.log(`🔄 [PROXY MANAGER] Reloaded ${loadResult.loaded} new proxies from Webshare (${this.proxies.length} active)`);

    // Save full list to DB so blacklisted IPs remain findable after redeploy
    await this.syncProxiesToDB(loadResult.proxies);
    return { newProxies, reloadedCount: loadResult.loaded };
  }

  // ---------------------------------------------------------------------------

  /**
   * Replace proxies automatically by extracting IPs from blacklist
   * Only replaces 1 IP per call in automatic mode
   * If an IP is not found in the proxy list, it's removed from blacklist and tries the next one
   *
   * @param replaceCount - Number of new proxies to get for each replacement
   * @param dryRun - If true, performs a dry run without actual replacement
   * @returns Success status, removed proxies, and reloaded proxies count
   */
  async replaceProxiesAutomatic(
    replaceCount: number = 2,
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
    cleanedBlacklistIps?: string[];
  }> {
    const excludeIps = new Set([]);

    const loadResult = await webshareApi.loadFromWebshare();
    await this.cleanExcludedBlacklistEntries(excludeIps, loadResult.proxies);

    const blacklistedIps = await this.getBlacklistedIps(excludeIps);
    console.log(`📋 [PROXY MANAGER] Automatic mode: Found ${blacklistedIps.length} blacklisted IPs (excluded: ${Array.from(excludeIps).join(', ')})`);

    if (blacklistedIps.length === 0) {
      return {
        success: false,
        message: 'No blacklisted IPs found (all may be excluded)',
        removedProxies: [], newProxies: [], reloadedCount: 0,
        totalProxies: this.proxies.length,
        error: 'No IPs to replace', cleanedBlacklistIps: []
      };
    }

    // Load all proxies from database to check against blacklist
    const dbProxies = await proxiesDb.getAllProxies();
    const dbProxyIps = new Set(
      dbProxies.map(p => { try { return new URL(p.server).hostname; } catch { return null; } })
        .filter((ip): ip is string => ip !== null)
    );
    console.log(`📊 [PROXY MANAGER] Database contains ${dbProxyIps.size} unique IPs`);

    const { ipToProcess, cleanedBlacklistIps } = await this.findValidIpToProcess(blacklistedIps, dbProxyIps);

    if (!ipToProcess) {
      return {
        success: false,
        message: `No valid IPs to replace. Cleaned ${cleanedBlacklistIps.length} unreachable IPs from blacklist`,
        removedProxies: [], newProxies: [], reloadedCount: 0,
        totalProxies: this.proxies.length,
        error: 'No valid IPs in proxy pool', cleanedBlacklistIps
      };
    }

    console.log(`📋 [PROXY MANAGER] Automatic mode: Processing IP ${ipToProcess} (cleaned ${cleanedBlacklistIps.length} unreachable IPs)`);

    const ipsToProcess = [ipToProcess];
    const webshareResult = await webshareApi.replaceProxies(ipsToProcess, excludeIps, replaceCount, dryRun);

    if (!webshareResult.success) {
      return {
        success: false,
        message: `Webshare API replacement failed: ${webshareResult.message}`,
        removedProxies: [], newProxies: [], reloadedCount: 0,
        totalProxies: this.proxies.length,
        error: webshareResult.error, cleanedBlacklistIps
      };
    }

    const removedProxies = await this.removeProxiesFromPool(ipsToProcess);

    let newProxies: ProxyInfo[] = [];
    let reloadedCount = 0;
    if (!dryRun) {
      ({ newProxies, reloadedCount } = await this.reloadAndPersistProxies(this.proxies.length));
    }

    return {
      success: true,
      message: `Successfully replaced ${ipsToProcess.length} proxies via Webshare API${dryRun ? ' (dry run)' : ''}. Cleaned ${cleanedBlacklistIps.length} unreachable IPs from blacklist`,
      webshareResponse: webshareResult.response,
      removedProxies, newProxies, reloadedCount,
      totalProxies: this.proxies.length, cleanedBlacklistIps
    };
  }

  /**
   * Check if a proxy exists
   */
  proxyExists(proxyServer: string): boolean {
    return this.proxies.some(p => p.server === proxyServer);
  }
}

// =============================================================================
// CHECK QUOTA - HELPER FUNCTIONS
// =============================================================================

/**
 * Launch Firefox browser with specified proxy configuration
 */
export async function launchBrowserWithProxy(proxyConfig: any): Promise<any> {
  console.log(`🌍 [CHECK-QUOTA] Launching browser with proxy ${proxyConfig.server}`);
  return await firefox.launch({
    headless: false,
    args: ['--no-sandbox'],
    proxy: proxyConfig
  });
}

/**
 * Setup browser context, create page, and navigate to Aftership
 */
export async function setupPageAndNavigate(browser: any): Promise<{ context: any; page: any }> {
  console.log(`📋 [CHECK-QUOTA] Creating browser context`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1080 } });

  console.log(`📄 [CHECK-QUOTA] Creating page`);
  const page = await context.newPage();
  page.setDefaultTimeout(120000);

  await applyStealthPatches(page);
  await setStealthHeaders(page);

  console.log(`🌐 [CHECK-QUOTA] Navigating to aftership.com`);
  await page.goto('https://www.aftership.com/track?c=jtexpress-vn&t=859882419163,859886765769,859887559163,859884882564,859881603267', {
    waitUntil: 'networkidle',
    timeout: 60000
  });

  console.log(`⏳ [CHECK-QUOTA] Waiting for page to settle`);
  await page.waitForTimeout(5000);

  return { context, page };
}

/**
 * Cleanup browser resources
 */
export async function cleanupBrowserResources(browser: any, context: any, page: any): Promise<void> {
  if (page && !page.isClosed()) {
    await page.close().catch((e: any) => console.log('Error closing page:', e));
  }
  if (context) {
    await context.close().catch((e: any) => console.log('Error closing context:', e));
  }
  if (browser?.isConnected?.()) {
    await browser.close().catch((e: any) => console.log('Error closing browser:', e));
  }
  console.log(`🔌 [CHECK-QUOTA] Cleanup completed`);
}

// Singleton instance
export const proxyManager = new ProxyManager();
