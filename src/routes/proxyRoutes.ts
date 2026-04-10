import { Request, Response, Router } from 'express';
import { cleanupBrowserResources, launchBrowserWithProxy, proxyManager, setupPageAndNavigate } from '../helpers/proxy';

const router = Router();

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

/**
 * POST /api/v1/proxy/replace-blacklist-proxies
 * Replace blacklisted proxies via Webshare API and reload the proxy pool
 * Automatically identifies blacklisted proxies in the pool, calls Webshare API to replace them,
 * removes old blacklisted proxies from pool, and reloads new proxies from Webshare
 * 
 * Body: {
 *  dryRun?: boolean            // Optional: performs dry run without actual replacement (default: true)
 * }
 */
router.post('/replace-blacklist-proxies', async (req: Request, res: Response): Promise<void> => {
  const { dryRun = true } = req.body;
  try {
    const result = await proxyManager.replaceProxiesAutomatic(1, dryRun);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
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
    console.error('❌ [WEBSHARE] Error replacing blacklisted proxies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to replace blacklisted proxies'
    });
  }
})

// =============================================================================
// CHECK QUOTA
// =============================================================================

/**
 * POST /api/v1/proxy/check-quota
 * Check proxy quota by navigating to Aftership page and taking screenshot
 * Body: {
 *   server: string,             // Required: Proxy server address (e.g., 104.249.29.190:5883)
 *   username?: string,          // Optional: Proxy username
 *   password?: string,          // Optional: Proxy password
 *   bypass?: string             // Optional: Proxy bypass
 * }
 */
router.post('/check-quota', async (req: Request, res: Response): Promise<void> => {
  let browser: any = null;
  let context: any = null;
  let page: any = null;

  try {
    const { server, username, password, bypass } = req.body;

    if (!server) {
      res.status(400).json({
        success: false,
        error: 'Proxy server is required'
      });
      return;
    }

    console.log(`🔍 [CHECK-QUOTA] Starting quota check for proxy ${server}`);

    const proxyConfig: any = {
      server,
      ...(username && { username }),
      ...(password && { password }),
      ...(bypass && { bypass })
    };

    browser = await launchBrowserWithProxy(proxyConfig);
    const { context: ctx, page: pg } = await setupPageAndNavigate(browser);
    context = ctx;
    page = pg;

    console.log(`📸 [CHECK-QUOTA] Taking screenshot`);
    const screenshot = await page.screenshot({ fullPage: false, clip: { x: 0, y: 0, width: 1280, height: 1080 } });

    const pageText = await page.evaluate(() => (globalThis as any).document.body.innerText || '');
    const hasQuotaExceeded = pageText.includes('Quota Exceeded');

    console.log(`✅ [CHECK-QUOTA] Screenshot captured successfully`);

    res.type('image/png');
    res.set('X-Proxy-Server', server);
    res.set('X-Quota-Exceeded', hasQuotaExceeded.toString());
    res.send(Buffer.from(screenshot));
  } catch (error: any) {
    console.error('❌ [CHECK-QUOTA] Error checking quota:', error);

    let errorScreenshot = null;
    if (page?.isClosed?.() === false) {
      try {
        errorScreenshot = await page.screenshot({ fullPage: false, clip: { x: 0, y: 0, width: 1280, height: 1080 } });
      } catch (screenshotError) {
        console.error('❌ [CHECK-QUOTA] Error capturing screenshot:', screenshotError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to check quota',
      details: error.message,
      screenshot: errorScreenshot ? Buffer.from(errorScreenshot).toString('base64') : null
    });
  } finally {
    await cleanupBrowserResources(browser, context, page);
  }
});

export default router;
