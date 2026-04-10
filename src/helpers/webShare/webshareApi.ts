/**
 * Webshare API integration module
 * Handles all Webshare proxy API operations
 */

import { env } from '../env';

// ---------------------------------------------------------------------------
// Webshare API types
// ---------------------------------------------------------------------------
export interface WebshareProxy {
  id: string;
  username: string;
  password: string;
  proxy_address: string;
  port: number;
  valid: boolean;
}

export interface WebshareListResponse {
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

export interface WebsharePackage {
  id: number;
  status: 'active' | 'cancelled';
  proxy_replacements_total: number;
  proxy_replacements_used: number;
  proxy_replacements_available: number;
  proxy_count: number;
  proxy_type: string;
  proxy_countries: Record<string, number>;
}

export interface WebsharePackagesResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: WebsharePackage[];
}

// ---------------------------------------------------------------------------
// Webshare API client
// ---------------------------------------------------------------------------

class WebshareApi {
  constructor(private proxies: ProxyInfo[] = []) { }

  /**
   * Fetch all proxies from the Webshare API (handles pagination automatically).
   * Returns the fetched list without modifying internal state.
   * Only proxies with `valid: true` are included.
   *
   * Environment variables:
   *   WEBSHARE_API_KEY   – Bearer token for Webshare API (required)
   *   WEBSHARE_PROXY_MODE – `direct` | `backbone` etc. (default: "direct")
   */
  async loadFromWebshare(): Promise<{ loaded: number; skipped: number; proxies: ProxyInfo[] }> {
    const apiKey = env.webshareApiKey;
    if (!apiKey) {
      console.warn('⚠️  [WEBSHARE] WEBSHARE_API_KEY is not set – skipping load');
      return { loaded: 0, skipped: 0, proxies: [] };
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

    console.log(
      `✅ [WEBSHARE] Loaded ${totalLoaded} proxies (${totalSkipped} invalid/skipped). Total: ${fetched.length}`
    );

    return { loaded: totalLoaded, skipped: totalSkipped, proxies: fetched };
  }

  /**
   * Replace proxies in Webshare API by IP addresses
   *
   * @param ipAddresses - Array of IP addresses to replace
   * @param isAutomatic - If true, extract IPs from blacklist (not implemented in this method)
   * @param replaceCount - Number of proxies to replace with (default: 2)
   * @param dryRun - If true, performs a dry run without actual replacement (default: false)
   * @returns Success status and API response
   */
  async replaceProxies(
    ipAddresses: string[],
    excludeIps: Set<string>,
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

    const replacementQuota = await this.getReplacementQuota();
    if (!replacementQuota.success) {
      return {
        success: false,
        message: 'Failed to retrieve replacement quota',
        error: replacementQuota.error
      };
    }

    if (replacementQuota.quota && replacementQuota.quota.available < replaceCount) {
      return {
        success: false,
        message: `Not enough replacement quota available. Required: ${replaceCount}, Available: ${replacementQuota.quota.available}`,
        error: 'Insufficient quota'
      };
    }

    // Filter out excluded IPs
    const ipsToReplace = ipAddresses.filter(ip => !excludeIps.has(ip));

    console.log(`📌 [WEBSHARE] IPs to replace: ${ipsToReplace.join(', ')}`);
    console.log(`🚫 [WEBSHARE] Excluded IPs: ${Array.from(excludeIps).join(', ')}`);

    if (ipsToReplace.length === 0) {
      return {
        success: false,
        message: 'No IP addresses to replace (all IPs are excluded)',
        error: 'All IPs filtered out'
      };
    }

    const url = 'https://proxy.webshare.io/api/v2/proxy/replace/';
    const payload = {
      to_replace: {
        type: 'ip_address',
        ip_addresses: ipsToReplace
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
        `🔄 [WEBSHARE] Replacing ${ipsToReplace.length} proxies (dry_run: ${dryRun}) …`
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
        message: `Successfully replaced ${ipsToReplace.length} proxies (excluded ${excludeIps.size})`,
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

  /**
   * Get proxy packages and retrieve the available replacement quota
   * @returns The replacement quota information from the active package
   */
  async getReplacementQuota(): Promise<{
    success: boolean;
    message: string;
    quota?: {
      total: number;
      used: number;
      available: number;
      packageId: number;
      proxyCount: number;
      status: string;
    };
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

    const url = 'https://proxy.webshare.io/api/v2/subscription/plan/';

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json() as WebsharePackagesResponse;

      if (!response.ok) {
        console.error(
          `❌ [WEBSHARE] Get packages failed with HTTP ${response.status}`
        );
        return {
          success: false,
          message: `Get packages failed with status ${response.status}`,
          error: JSON.stringify(data)
        };
      }

      // Find the first active package
      const activePackage = data.results.find(pkg => pkg.status === 'active');

      if (!activePackage) {
        return {
          success: false,
          message: 'No active proxy package found',
          error: 'All packages are cancelled'
        };
      }

      console.log(`✅ [WEBSHARE] Retrieved replacement quota: ${activePackage.proxy_replacements_available} available`);

      return {
        success: true,
        message: `Successfully retrieved replacement quota`,
        quota: {
          total: activePackage.proxy_replacements_total,
          used: activePackage.proxy_replacements_used,
          available: activePackage.proxy_replacements_available,
          packageId: activePackage.id,
          proxyCount: activePackage.proxy_count,
          status: activePackage.status
        }
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`❌ [WEBSHARE] Get replacement quota error:`, err);
      return {
        success: false,
        message: 'Failed to get replacement quota',
        error: errorMessage
      };
    }
  }
}

// Singleton instance
export const webshareApi = new WebshareApi();
