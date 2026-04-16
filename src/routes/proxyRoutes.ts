import { Request, Response, Router } from 'express';
import { proxyManager } from '../helpers/proxy';

const router = Router();

/**
 * GET /api/v1/proxy
 * Get all proxies with statistics
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const proxies = proxyManager.getAllProxies();
    const stats = await proxyManager.getProxyStats();

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

// =============================================================================
// BLACKLIST
// =============================================================================

/**
 * GET /api/v1/proxy/blacklist
 * Get all current blacklist entries.
 * Each entry includes `inProxyPool` indicating whether the proxy server
 * is still present in the active proxy pool.
 * Note: `expiresIn` is only present for temporary issues (not QUOTA_EXCEEDED).
 */
router.get('/blacklist', async (req: Request, res: Response): Promise<void> => {
  try {
    const blacklist = await proxyManager.getBlacklist();

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
          code: entry.code || 'N/A'
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
 * DELETE /api/v1/proxy/blacklist
 * Remove an entry from the blacklist by proxy server address
 * 
 * Query params:
 *   proxyServer: string // Required: proxy server address (e.g., "http://1.2.3.4:8080")
 */
router.delete('/blacklist', async (req: Request, res: Response): Promise<void> => {
  try {
    const { proxyServer } = req.query;

    // Validate input
    if (!proxyServer || typeof proxyServer !== 'string') {
      res.status(400).json({
        success: false,
        error: 'proxyServer is required and must be a string'
      });
      return;
    }

    // Find all entries with this proxy server and remove them
    const blacklist = await proxyManager.getBlacklist();
    const entriesToRemove = blacklist.filter(entry => entry.proxyServer === proxyServer);

    if (entriesToRemove.length === 0) {
      res.status(404).json({
        success: false,
        error: `No blacklist entries found for proxy server: ${proxyServer}`
      });
      return;
    }

    // Remove all entries for this proxy server
    for (const entry of entriesToRemove) {
      await proxyManager.removeFromBlacklist(entry.provider, proxyServer);
    }

    res.json({
      success: true,
      message: `Removed ${entriesToRemove.length} blacklist entry(ies) for proxy server: ${proxyServer}`,
      data: {
        proxyServer,
        removedCount: entriesToRemove.length,
        removedEntries: entriesToRemove.map(e => ({
          provider: e.provider,
          reason: e.reason,
          timestamp: new Date(e.timestamp).toISOString()
        }))
      }
    });
  } catch (error: any) {
    console.error('❌ [BLACKLIST] Error removing from blacklist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove from blacklist'
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
