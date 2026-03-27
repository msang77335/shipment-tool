import { Request, Response, Router } from 'express';
import { blacklistManager } from '../helpers/blacklistManager';

const router = Router();

/**
 * GET /api/v1/blacklist
 * Retrieve all current blacklist entries
 */
router.get('/', (req: Request, res: Response): void => {
  try {
    const blacklist = blacklistManager.getBlacklist();
    
    res.json({
      success: true,
      data: {
        totalEntries: blacklist.length,
        entries: blacklist.map(entry => ({
          provider: entry.provider,
          proxyServer: entry.proxyServer || 'N/A',
          reason: entry.reason,
          timestamp: new Date(entry.timestamp).toISOString(),
          code: entry.code || 'N/A',
          expiresIn: (entry as any).expiresIn // Seconds until expiry
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
 * GET /api/v1/blacklist/stats
 * Get statistics about blacklist entries
 */
router.get('/stats', (req: Request, res: Response): void => {
  try {
    const stats = blacklistManager.getBlacklistStats();
    const totalEntries = blacklistManager.getBlacklist().length;
    
    res.json({
      success: true,
      data: {
        totalEntries,
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
 * POST /api/v1/blacklist/remove
 * Remove an entry from blacklist
 * Body: { provider: string, proxyServer?: string }
 */
router.post('/remove', (req: Request, res: Response): void => {
  try {
    const { provider, proxyServer } = req.body;

    if (!provider) {
      res.status(400).json({
        success: false,
        error: 'Provider is required'
      });
      return;
    }

    blacklistManager.removeFromBlacklist(provider, proxyServer);

    const proxyInfo = proxyServer ? ` (${proxyServer})` : '';
    const message = `Removed ${provider}${proxyInfo} from blacklist`;

    res.json({
      success: true,
      message
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
 * POST /api/v1/blacklist/clear
 * Clear all blacklist entries
 */
router.post('/clear', (req: Request, res: Response): void => {
  try {
    const currentCount = blacklistManager.getBlacklist().length;
    blacklistManager.clearBlacklist();

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

/**
 * GET /api/v1/blacklist/check
 * Check if a specific provider/proxy is blacklisted
 * Query: { provider: string, proxyServer?: string }
 */
router.get('/check', (req: Request, res: Response): void => {
  try {
    const { provider, proxyServer } = req.query;

    if (!provider) {
      res.status(400).json({
        success: false,
        error: 'Provider query parameter is required'
      });
      return;
    }

    const { isBlacklisted, entry } = blacklistManager.isBlacklisted(
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

export default router;
