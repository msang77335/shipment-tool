/**
 * Proxy Manager - Manages proxy pool dynamically with integrated blacklist tracking
 * Supports: add proxy, remove proxy, remove proxies by blacklist
 * Tracks blocking issues (quota exceeded, IP blocks, etc.)
 * Supports loading proxies from Webshare API (with full pagination)
 */

import { PlaywrightBrowserSingleton } from '../browser/PlaywrightBrowserSingleton';
import { env } from '../env';
import { applyStealthPatches, setStealthHeaders } from '../index';
const { firefox } = require('playwright-extra');

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
}

class ProxyManager {
  private proxies: ProxyInfo[] = [];
  private blacklist: Map<string, BlacklistEntry> = new Map();

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
    return Array.from(this.blacklist.values());
  }

  /**
   * Generate unique key for blacklist entry
   */
  private getBlacklistKey(provider: string, proxyServer?: string): string {
    return proxyServer ? `${provider}:${proxyServer}` : provider;
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

        // Remove from blacklist if exists
        const blacklist = this.getBlacklist();
        for (const entry of blacklist) {
          if (entry.proxyServer === removed.server) {
            this.removeFromBlacklist(entry.provider, entry.proxyServer);
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
   * Check if a proxy exists
   */
  proxyExists(proxyServer: string): boolean {
    return this.proxies.some(p => p.server === proxyServer);
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
  await page.waitForTimeout(3000);

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
