import { Request, Response, Router } from 'express';
import { proxyManager, ProxyInfo } from '../helpers/proxyManager';

const router = Router();

// =============================================================================
// PROXY POOL
// =============================================================================

/**
 * GET /api/v1/proxy
 * Get all proxies
 */
router.get('/', (req: Request, res: Response): void => {
  try {
    const proxies = proxyManager.getAllProxies();
    const stats = proxyManager.getProxyStats();

    res.json({
      success: true,
      data: {
        stats,
        proxies: proxies.map(p => ({
          server: p.server,
          username: p.username || 'N/A',
          password: p.password ? '***' : 'N/A',
          bypass: p.bypass || 'N/A'
        }))
      }
    });
  } catch (error: any) {
    console.error('❌ [PROXY] Error retrieving proxies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve proxies'
    });
  }
});

/**
 * GET /api/v1/proxy/stats
 * Get proxy statistics
 */
router.get('/stats', (req: Request, res: Response): void => {
  try {
    const stats = proxyManager.getProxyStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('❌ [PROXY] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve proxy statistics'
    });
  }
});

/**
 * GET /api/v1/proxy/check/:proxyServer
 * Check if a proxy exists
 * URL param: proxyServer (URL encoded proxy server address)
 */
router.get('/check/:proxyServer', (req: Request, res: Response): void => {
  try {
    const proxyServer = decodeURIComponent(req.params.proxyServer as string);
    const exists = proxyManager.proxyExists(proxyServer);
    const proxy = proxyManager.getProxyByServer(proxyServer);

    res.json({
      success: true,
      data: {
        exists,
        proxy: proxy ? {
          server: proxy.server,
          username: proxy.username || 'N/A'
        } : null
      }
    });
  } catch (error: any) {
    console.error('❌ [PROXY] Error checking proxy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check proxy'
    });
  }
});

/**
 * POST /api/v1/proxy
 * Add a new proxy
 * Body: { server: string, username?: string, password?: string, bypass?: string }
 */
router.post('/', (req: Request, res: Response): void => {
  try {
    const proxyInfo: ProxyInfo = req.body;

    const result = proxyManager.addProxy(proxyInfo);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        totalProxies: result.totalProxies
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        totalProxies: result.totalProxies
      });
    }
  } catch (error: any) {
    console.error('❌ [PROXY] Error adding proxy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add proxy'
    });
  }
});

/**
 * PUT /api/v1/proxy/:proxyServer
 * Update a proxy
 * URL param: proxyServer (URL encoded proxy server address)
 * Body: { username?: string, password?: string, bypass?: string }
 */
router.put('/:proxyServer', (req: Request, res: Response): void => {
  try {
    const proxyServer = decodeURIComponent(req.params.proxyServer as string);
    const updates = req.body;

    const result = proxyManager.updateProxy(proxyServer, updates);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        proxy: {
          server: result.proxy?.server,
          username: result.proxy?.username || 'N/A',
          password: result.proxy?.password ? '***' : 'N/A',
          bypass: result.proxy?.bypass || 'N/A'
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.message
      });
    }
  } catch (error: any) {
    console.error('❌ [PROXY] Error updating proxy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update proxy'
    });
  }
});

/**
 * DELETE /api/v1/proxy/:proxyServer
 * Delete a proxy by server URL
 * URL param: proxyServer (URL encoded proxy server address)
 */
router.delete('/:proxyServer', async (req: Request, res: Response): Promise<void> => {
  try {
    const proxyServer = decodeURIComponent(req.params.proxyServer as string);

    const result = await proxyManager.removeProxy(proxyServer);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        totalProxies: result.totalProxies
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.message,
        totalProxies: result.totalProxies
      });
    }
  } catch (error: any) {
    console.error('❌ [PROXY] Error removing proxy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove proxy'
    });
  }
});

// =============================================================================
// BLACKLIST
// =============================================================================

/**
 * POST /api/v1/proxy/remove-blacklisted
 * Remove from proxy pool all proxies that are currently in the blacklist
 */
router.post('/remove-blacklisted', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await proxyManager.removeBlacklistedProxies();

    res.json({
      success: true,
      message: result.message,
      removed: result.removed.map(p => ({
        server: p.server,
        username: p.username || 'N/A'
      })),
      remainingProxies: result.remaining
    });
  } catch (error: any) {
    console.error('❌ [PROXY] Error removing blacklisted proxies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove blacklisted proxies'
    });
  }
});

/**
 * GET /api/v1/proxy/blacklist
 * Get all current blacklist entries.
 * Each entry includes `inProxyPool` indicating whether the proxy server
 * is still present in the active proxy pool.
 * Note: `expiresIn` is only present for temporary issues (not QUOTA_EXCEEDED).
 */
router.get('/blacklist', (req: Request, res: Response): void => {
  try {
    const blacklist = proxyManager.getBlacklist();

    res.json({
      success: true,
      data: {
        totalEntries: blacklist.length,
        entries: blacklist.map(entry => ({
          provider: entry.provider,
          proxyServer: entry.proxyServer || 'N/A',
          inProxyPool: entry.proxyServer ? proxyManager.proxyExists(entry.proxyServer) : false,
          reason: entry.reason,
          timestamp: new Date(entry.timestamp).toISOString(),
          code: entry.code || 'N/A',
          ...(entry.reason !== 'QUOTA_EXCEEDED' && { expiresIn: entry.expiresIn })
        }))
      }
    });
  } catch (error: any) {
    console.error('❌ [BLACKLIST] Error retrieving blacklist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve blacklist'
    });
  }
});

/**
 * GET /api/v1/proxy/blacklist/stats
 * Get statistics about blacklist entries
 */
router.get('/blacklist/stats', (req: Request, res: Response): void => {
  try {
    const stats = proxyManager.getBlacklistStats();

    res.json({
      success: true,
      data: {
        totalEntries: stats.totalEntries,
        byReason: stats.byReason,
        byProvider: stats.byProvider
      }
    });
  } catch (error: any) {
    console.error('❌ [BLACKLIST] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics'
    });
  }
});

/**
 * GET /api/v1/proxy/blacklist/check
 * Check if a specific provider/proxy is blacklisted
 * Query: { provider: string, proxyServer?: string }
 */
router.get('/blacklist/check', (req: Request, res: Response): void => {
  try {
    const { provider, proxyServer } = req.query;

    if (!provider) {
      res.status(400).json({
        success: false,
        error: 'Provider query parameter is required'
      });
      return;
    }

    const { isBlacklisted, entry } = proxyManager.isBlacklisted(
      provider as string,
      proxyServer as string | undefined
    );

    res.json({
      success: true,
      data: {
        provider,
        proxyServer: proxyServer || null,
        isBlacklisted,
        ...(isBlacklisted && entry && {
          reason: entry.reason,
          timestamp: new Date(entry.timestamp).toISOString(),
          code: entry.code
        })
      }
    });
  } catch (error: any) {
    console.error('❌ [BLACKLIST] Error checking blacklist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check blacklist'
    });
  }
});

/**
 * POST /api/v1/proxy/blacklist/remove
 * Remove an entry from blacklist
 * Body: { provider: string, proxyServer?: string }
 */
router.post('/blacklist/remove', (req: Request, res: Response): void => {
  try {
    const { provider, proxyServer } = req.body;

    if (!provider) {
      res.status(400).json({
        success: false,
        error: 'Provider is required'
      });
      return;
    }

    proxyManager.removeFromBlacklist(provider, proxyServer);

    const proxyInfo = proxyServer ? ` (${proxyServer})` : '';
    res.json({
      success: true,
      message: `Removed ${provider}${proxyInfo} from blacklist`
    });
  } catch (error: any) {
    console.error('❌ [BLACKLIST] Error removing entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove entry from blacklist'
    });
  }
});

/**
 * POST /api/v1/proxy/blacklist/clear
 * Clear all blacklist entries
 */
router.post('/blacklist/clear', (req: Request, res: Response): void => {
  try {
    const currentCount = proxyManager.getBlacklist().length;
    proxyManager.clearBlacklist();

    res.json({
      success: true,
      message: `Cleared ${currentCount} entries from blacklist`
    });
  } catch (error: any) {
    console.error('❌ [BLACKLIST] Error clearing blacklist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear blacklist'
    });
  }
});

// =============================================================================
// GRAYLIST
// =============================================================================

/**
 * GET /api/v1/proxy/graylist
 * Get all current gray list entries (proxies without tracking data)
 */
router.get('/graylist', (req: Request, res: Response): void => {
  try {
    const graylist = proxyManager.getGrayList();

    res.json({
      success: true,
      data: {
        totalEntries: graylist.length,
        entries: graylist.map(entry => ({
          provider: entry.provider,
          proxyServer: entry.proxyServer || 'N/A',
          tries: entry.tries,
          reason: entry.reason,
          lastAttempt: new Date(entry.lastAttempt).toISOString()
        }))
      }
    });
  } catch (error: any) {
    console.error('❌ [GRAYLIST] Error retrieving graylist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve gray list'
    });
  }
});

/**
 * GET /api/v1/proxy/graylist/stats
 * Get statistics about gray list entries
 */
router.get('/graylist/stats', (req: Request, res: Response): void => {
  try {
    const stats = proxyManager.getGrayListStats();

    res.json({
      success: true,
      data: {
        totalEntries: stats.totalEntries,
        byProvider: stats.byProvider,
        highestTries: stats.highestTries
      }
    });
  } catch (error: any) {
    console.error('❌ [GRAYLIST] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve gray list statistics'
    });
  }
});

/**
 * DELETE /api/v1/proxy/graylist/:proxyServer
 * Remove an entry from gray list
 * URL param: proxyServer (URL encoded proxy server address)
 * Query: provider (required)
 */
router.delete('/graylist/:proxyServer', (req: Request, res: Response): void => {
  try {
    const proxyServer = decodeURIComponent(req.params.proxyServer as string);
    const providerQuery = req.query.provider;

    if (!providerQuery || typeof providerQuery !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Provider query parameter is required'
      });
      return;
    }

    proxyManager.removeFromGrayList(providerQuery, proxyServer);

    res.json({
      success: true,
      message: `Removed ${providerQuery} from gray list for proxy ${proxyServer}`
    });
  } catch (error: any) {
    console.error('❌ [GRAYLIST] Error removing entry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove entry from gray list'
    });
  }
});

/**
 * POST /api/v1/proxy/graylist/clear
 * Clear all gray list entries
 */
router.post('/graylist/clear', (req: Request, res: Response): void => {
  try {
    const currentCount = proxyManager.getGrayList().length;
    proxyManager.clearGrayList();

    res.json({
      success: true,
      message: `Cleared ${currentCount} entries from gray list`
    });
  } catch (error: any) {
    console.error('❌ [GRAYLIST] Error clearing graylist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear gray list'
    });
  }
});

// =============================================================================
// WEBSHARE API
// =============================================================================

/**
 * POST /api/v1/proxy/replace-proxies
 * Replace proxies via Webshare API and reload the proxy pool
 * Calls Webshare API to replace specific IP addresses, removes old proxies from pool,
 * and reloads new proxies from Webshare
 * 
 * Body: {
 *   ipAddresses: string[],      // Required: IP addresses to replace
 *   replaceCount?: number,      // Optional: number of proxies to get per replacement (default: 2)
 *   dryRun?: boolean            // Optional: performs dry run without actual replacement (default: false)
 * }
 */
router.post('/replace-proxies', async (req: Request, res: Response): Promise<void> => {
  try {
    const { ipAddresses, dryRun = false } = req.body;

    // Validate input
    if (!ipAddresses || !Array.isArray(ipAddresses) || ipAddresses.length === 0) {
      res.status(400).json({
        success: false,
        error: 'ipAddresses is required and must be a non-empty array'
      });
      return;
    }

    const result = await proxyManager.replaceProxiesAndReload(ipAddresses, dryRun);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          replacedIPs: ipAddresses,
          dryRun,
          removedProxies: result.removedProxies.map(p => ({
            server: p.server,
            username: p.username || 'N/A'
          })),
          newProxies: result.newProxies.map(p => ({
            server: p.server,
            username: p.username || 'N/A',
            password: p.password ? '***' : 'N/A',
            bypass: p.bypass || 'N/A'
          })),
          reloadedCount: result.reloadedCount,
          totalProxies: result.totalProxies,
          webshareResponse: result.webshareResponse
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        details: result.error
      });
    }
  } catch (error: any) {
    console.error('❌ [WEBSHARE] Error replacing proxies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to replace proxies'
    });
  }
});

export default router;
