/**
 * JNT Phone Routes - API endpoints for managing JNT phone pool
 * GET  /api/jnt/phone               - List all phones
 * POST /api/jnt/phone               - Add phone(s)
 * POST /api/jnt/scan-phone          - Start background scan phone job
 * GET  /api/jnt/scan-phone/:id      - Get scan job result
 * GET  /api/jnt/scan-phone          - List scan jobs
 */

import { Request, Response, Router } from 'express';
import { phoneManager } from '../helpers/jnt/phone';
import { scanPhoneJobManager } from '../helpers/jnt/scanPhoneJobManager';
import { trackingHistManager } from '../helpers/jnt/trackingHist';
import { cleanupBrowserResources, launchBrowserWithProxy, proxyManager, setupPageAndNavigate } from '../helpers/proxy';

const router = Router();

/**
 * GET /api/v1/jnt/phone
 * Get all phone numbers in the pool with pagination
 * Query: ?page=1&limit=50
 * Examples:
 * - /api/v1/jnt/phone
 * - /api/v1/jnt/phone?page=2&limit=100
 * - /api/v1/jnt/phone?limit=20
 */
router.get('/phone', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50' } = req.query;

    // Parse pagination params
    const pageNum = Math.max(1, Number.parseInt(page as string) || 1);
    const limitNum = Math.min(500, Math.max(1, Number.parseInt(limit as string) || 50));

    // Get all phones and handle pagination
    const allPhones = await phoneManager.getAllPhones();
    
    // Calculate pagination
    const total = allPhones.length;
    const totalPages = Math.ceil(total / limitNum);
    const offset = (pageNum - 1) * limitNum;
    const paginatedData = allPhones.slice(offset, offset + limitNum);

    return res.json({
      status: 'success',
      data: paginatedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('❌ [JNT PHONE ROUTE] Error listing phones:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to list phones',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/v1/jnt/phone/:name
 * Get phones by specific name
 * Params: name - Account/seller name
 * Examples:
 * - /api/v1/jnt/phone/seller1
 * - /api/v1/jnt/phone/my-account
 */
router.get('/phone/:name', async (req: Request, res: Response) => {
  try {
    const nameParam = req.params.name;

    if (typeof nameParam !== 'string' || !nameParam || nameParam.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Name parameter is required'
      });
    }

    const phones = await phoneManager.getPhonesByName(nameParam);

    if (!phones || phones.length === 0) {
      return res.status(404).json({
        status: 'not_found',
        message: `No phones found for name: ${nameParam}`,
        name: nameParam,
        phones: []
      });
    }

    return res.json({
      status: 'success',
      data: {
        name: nameParam,
        phones
      },
      count: phones.length
    });
  } catch (error) {
    console.error('❌ [JNT PHONE ROUTE] Error getting phones by name:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get phones by name',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/v1/jnt/phone
 * Add phone number(s) to the pool
 * Body: { sellerPhone: [ { name: string, phones: string[] } ] }
 */
router.post('/phone', async (req: Request, res: Response) => {
  try {
    const { sellerPhone } = req.body;

    if (!sellerPhone || !Array.isArray(sellerPhone)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request. Expected: { sellerPhone: string[] or object[] }'
      });
    }

    if (sellerPhone.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone list cannot be empty'
      });
    }

    const addedPhones = await phoneManager.addPhones(sellerPhone);
    const allPhones = await phoneManager.getAllPhones();
    const totalPhones = allPhones.reduce((sum, group) => sum + group.phones.length, 0);

    return res.json({
      status: 'success',
      data: addedPhones,
      addedCount: addedPhones.length,
      totalPhones: totalPhones
    });
  } catch (error) {
    console.error('❌ [JNT PHONE ROUTE] Error adding phones:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to add phones',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * DELETE /api/v1/jnt/phone/:name
 * Delete all phones for a specific name
 * Params: name - Account/seller name
 * Examples:
 * - /api/v1/jnt/phone/seller1
 * - /api/v1/jnt/phone/my-account
 */
router.delete('/phone/:name', async (req: Request, res: Response) => {
  try {
    const nameParam = req.params.name;

    if (typeof nameParam !== 'string' || !nameParam || nameParam.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Name parameter is required'
      });
    }

    const deletedCount = await phoneManager.deletePhonesByName(nameParam);

    if (deletedCount === 0) {
      return res.status(404).json({
        status: 'not_found',
        message: `No phones found for name: ${nameParam}`,
        name: nameParam,
        deletedCount: 0
      });
    }

    const allPhones = await phoneManager.getAllPhones();
    const totalPhones = allPhones.reduce((sum, group) => sum + group.phones.length, 0);

    return res.json({
      status: 'success',
      message: `Deleted ${deletedCount} phone(s) for name: ${nameParam}`,
      name: nameParam,
      deletedCount,
      totalPhones
    });
  } catch (error) {
    console.error('❌ [JNT PHONE ROUTE] Error deleting phones by name:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete phones by name',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/v1/jnt/scan-phone
 * Start background brute-force scan for valid phone number
 * Body: { codes: string }
 * Returns: { status: 'success', jobId: string, job: ScanPhoneJob }
 * Note: Only allows one processing job at a time
 */
router.post('/scan-phone', async (req: Request, res: Response) => {
  try {
    const { codes, startFrom } = req.body;

    if (!codes || typeof codes !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request. Expected: { codes: string }'
      });
    }

    // Create a new job
    const createJobResult = await scanPhoneJobManager.createJob(codes, startFrom || 0);

    // If job creation failed due to existing job or other reason, return error response
    if(!createJobResult.success || !createJobResult.job) {
      return res.status(500).json({
        status: 'error',
        message: createJobResult.message || 'Failed to create scan job',
      })
    }
    const job = createJobResult.job;

    scanPhoneJobManager.runJobInBackground(job.id);

    return res.json({
      status: 'success',
      jobId: job.id,
      job,
      message: 'Scan started in background. Use GET /api/jnt/scan-phone/{jobId} to check results'
    });
  } catch (error) {
    console.error('❌ [JNT ROUTE] Error creating scan job:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create scan job',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/v1/jnt/scan-phone/:id
 * Get status and result of a scan phone job
 * Returns: ScanPhoneJob with status and result
 */
router.get('/scan-phone/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Job ID is required'
      });
    }

    const job = await scanPhoneJobManager.getJob(id as string);

    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: `Job ${id} not found`
      });
    }

    return res.json({
      status: 'success',
      job
    });
  } catch (error) {
    console.error('❌ [JNT ROUTE] Error getting scan job:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get scan job',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /api/v1/jnt/scan-phone/:id/pause
 * Pause a processing scan job
 * The job will retain its attempt count and can be resumed later
 */
router.put('/scan-phone/:id/pause', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Job ID is required'
      });
    }

    const job = await scanPhoneJobManager.getJob(id as string);

    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: `Job ${id} not found`
      });
    }

    if (job.status !== 'processing') {
      return res.status(409).json({
        status: 'error',
        message: `Cannot pause job with status "${job.status}". Only processing jobs can be paused`,
        currentStatus: job.status,
        attemptCount: job.attemptCount
      });
    }

    await scanPhoneJobManager.pauseJob(id as string);

    const updatedJob = await scanPhoneJobManager.getJob(id as string);

    return res.json({
      status: 'success',
      message: 'Job paused successfully',
      job: updatedJob
    });
  } catch (error) {
    console.error('❌ [JNT ROUTE] Error pausing scan job:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to pause scan job',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /api/v1/jnt/scan-phone/:id/resume
 * Resume a paused scan job from saved attempt count
 * Continues brute force search from the saved progress
 */
router.put('/scan-phone/:id/resume', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Job ID is required'
      });
    }

    const job = await scanPhoneJobManager.getJob(id as string);

    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: `Job ${id} not found`
      });
    }

    if (job.status !== 'paused') {
      return res.status(409).json({
        status: 'error',
        message: `Cannot resume job with status "${job.status}". Only paused jobs can be resumed`,
        currentStatus: job.status
      });
    }

    // Check if there's already a processing job
    const existingProcessing = await scanPhoneJobManager.listJobs(1000, 'processing');
    if (existingProcessing.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'A scan job is already processing',
        processingJob: {
          id: existingProcessing[0].id,
          codes: existingProcessing[0].codes,
          attemptCount: existingProcessing[0].attemptCount
        }
      });
    }

    // Resume the job (update status to paused in DB)
    await scanPhoneJobManager.resumeJob(id as string);

    // Start background processing via event (don't await)
    await scanPhoneJobManager.resumeJobInBackground(id as string);

    const updatedJob = await scanPhoneJobManager.getJob(id as string);

    return res.json({
      status: 'success',
      message: 'Job resumed successfully. Continuing from saved attempt count',
      job: updatedJob
    });
  } catch (error) {
    console.error('❌ [JNT ROUTE] Error resuming scan job:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to resume scan job',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * DELETE /api/v1/jnt/scan-phone/:id
 * Delete a scan job by ID
 * Can delete jobs in any status (pending, processing, paused, success, error)
 */
router.delete('/scan-phone/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Job ID is required'
      });
    }

    const job = await scanPhoneJobManager.getJob(id as string);

    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: `Job ${id} not found`
      });
    }

    // Delete the job
    await scanPhoneJobManager.deleteJob(id as string);

    return res.json({
      status: 'success',
      message: 'Job deleted successfully',
      deletedJob: {
        id: job.id,
        codes: job.codes,
        status: job.status,
        createdAt: job.createdAt
      }
    });
  } catch (error) {
    console.error('❌ [JNT ROUTE] Error deleting scan job:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete scan job',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/v1/jnt/scan-phone
 * List recent scan phone jobs
 * Query: ?limit=100&status=pending|processing|paused|success|error
 * Examples:
 * - /api/v1/jnt/scan-phone
 * - /api/v1/jnt/scan-phone?limit=50
 * - /api/v1/jnt/scan-phone?status=success
 * - /api/v1/jnt/scan-phone?status=paused&limit=20
 */
router.get('/scan-phone', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number.parseInt(req.query.limit as string) || 100, 500);
    const status = req.query.status as 'pending' | 'processing' | 'paused' | 'success' | 'error' | undefined;
    const jobs = await scanPhoneJobManager.listJobs(limit, status);

    return res.json({
      status: 'success',
      jobs,
      count: jobs.length
    });
  } catch (error) {
    console.error('❌ [JNT ROUTE] Error listing scan jobs:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to list scan jobs',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/v1/jnt/tracking-history
 * Get tracking history for J&T and AfterShip with pagination
 * Query: ?page=1&limit=50&site=J&T|AfterShip&sort=recent|oldest
 * Examples:
 * - /api/v1/jnt/tracking-history
 * - /api/v1/jnt/tracking-history?page=2&limit=100
 * - /api/v1/jnt/tracking-history?site=AfterShip&page=1&limit=50
 * - /api/v1/jnt/tracking-history?sort=oldest
 */
router.get('/tracking-history', async (req: Request, res: Response) => {
  try {
    const { site, page = '1', limit = '50', sort = 'recent' } = req.query;
    const validSites = ["J&T", "AfterShip"];

    // Parse pagination params
    const pageNum = Math.max(1, Number.parseInt(page as string) || 1);
    const limitNum = Math.min(500, Math.max(1, Number.parseInt(limit as string) || 50));
    const sortBy = sort === 'oldest' ? 'oldest' : 'recent';

    // Validate site parameter if provided
    if (site && typeof site === 'string' && !validSites.includes(site)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid site parameter. Valid values are: ${validSites.join(', ')}`
      });
    }

    let result;
    
    if (site && typeof site === 'string') {
      result = await trackingHistManager.getHistBySite(site as "J&T" | "AfterShip", {
        page: pageNum,
        limit: limitNum,
        sortBy
      });
    } else {
      result = await trackingHistManager.getHistPaginated({
        page: pageNum,
        limit: limitNum,
        sortBy
      });
    }

    return res.json({
      status: 'success',
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('❌ [JNT ROUTE] Error getting tracking history:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get tracking history',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * DELETE /api/v1/jnt/tracking-history
 * Clear all tracking history records
 * Query: ?before=timestamp (optional, date in milliseconds) - Only clear records before this time
 */
router.delete('/tracking-history', async (req: Request, res: Response) => {
  try {
    const { before } = req.query;

    if (before) {
      // Clear history before specific timestamp
      const timestamp = Number.parseInt(before as string);
      if (Number.isNaN(timestamp)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid "before" parameter. Expected: unix timestamp in milliseconds'
        });
      }

      const now = Date.now();
      const count = await trackingHistManager.clearHistByDateRange(0, timestamp);
      return res.json({
        status: 'success',
        message: `Cleared ${count} tracking history entries before ${new Date(timestamp).toISOString()}`,
        clearedCount: count
      });
    } else {
      // Clear all history
      const count = await trackingHistManager.clearHist();
      return res.json({
        status: 'success',
        message: 'All tracking history cleared',
        clearedCount: count
      });
    }
  }
  catch (error) {
    console.error('❌ [JNT ROUTE] Error clearing tracking history:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to clear tracking history',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/v1/jnt/tracking-history
 * Add tracking history record(s)
 * Body: { 
 *   codes: string (tracking codes, comma-separated),
 *   bankAccountName: string (seller/account name),
 *   site: "J&T" | "AfterShip"
 * }
 * Can accept array for bulk add:
 * Body: [
 *   { codes: string, bankAccountName: string, site: "J&T" | "AfterShip" }
 * ]
 * Examples:
 * - Single: {"codes":"123456,789012","bankAccountName":"seller1","site":"J&T"}
 * - Bulk: [{"codes":"123","bankAccountName":"seller1","site":"J&T"},...]
 */
router.post('/tracking-history', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    
    // Handle both single object and array of objects
    const entries = Array.isArray(body) ? body : [body];

    if (entries.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Request body cannot be empty'
      });
    }

    const { addedEntries, errors } = await trackingHistManager.addTrackingHistoryEntries(entries);

    // Return response
    if (addedEntries.length === 0 && errors.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Failed to add tracking history entries',
        errors
      });
    }

    return res.json({
      status: 'success',
      message: `Added ${addedEntries.length} tracking history ${addedEntries.length === 1 ? 'entry' : 'entries'}`,
      data: addedEntries,
      addedCount: addedEntries.length,
      failedCount: errors.length,
      ...(errors.length > 0 && { errors })
    });
  } catch (error) {
    console.error('❌ [JNT ROUTE] Error adding tracking history:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to add tracking history',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});


// =============================================================================
// CHECK QUOTA
// =============================================================================

/**
 * POST /api/v1/jnt/check-quota
 * Check proxy quota by navigating to Aftership page and taking screenshot
 * Body: {
 *   server: string,             // Required: Proxy server address (e.g., 104.249.29.190:5883)
 *   username?: string,          // Optional: Proxy username
 *   password?: string,          // Optional: Proxy password
 *   bypass?: string             // Optional: Proxy bypass
 * }
 */

/**
 * Helper function to perform quota check
 */
async function performQuotaCheck(proxyConfig: any) {
  let browser: any = null;
  let context: any = null;
  let page: any = null;

  try {
    browser = await launchBrowserWithProxy(proxyConfig);
    const { context: ctx, page: pg } = await setupPageAndNavigate(browser);
    context = ctx;
    page = pg;

    console.log(`📸 [CHECK-QUOTA] Taking screenshot`);
    const screenshot = await page.screenshot({ fullPage: false, clip: { x: 0, y: 0, width: 1280, height: 1080 } });

    const pageText = await page.evaluate(() => (globalThis as any).document.body.innerText || '');
    const hasQuotaExceeded = pageText.includes('Quota Exceeded');

    if (hasQuotaExceeded) {
      await proxyManager.addToBlacklist({
        provider: 'Quota Check',
        proxyServer: proxyConfig.server,
        reason: 'QUOTA_EXCEEDED',
        code: 'QUOTA_EXCEEDED'
      });
    }

    console.log(`✅ [CHECK-QUOTA] Screenshot captured successfully`);
    return { screenshot, hasQuotaExceeded, error: null };
  } catch (error: any) {
    let errorScreenshot = null;
    if (page?.isClosed?.() === false) {
      try {
        errorScreenshot = await page.screenshot({ fullPage: false, clip: { x: 0, y: 0, width: 1280, height: 1080 } });
      } catch (screenshotError) {
        console.error('❌ [CHECK-QUOTA] Error capturing screenshot:', screenshotError);
      }
    }
    return { screenshot: null, hasQuotaExceeded: false, error, errorScreenshot };
  } finally {
    await cleanupBrowserResources(browser, context, page);
  }
}

router.post('/check-quota', async (req: Request, res: Response): Promise<void> => {
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

  const result = await performQuotaCheck(proxyConfig);

  if (result.error) {
    console.error('❌ [CHECK-QUOTA] Error checking quota:', result.error);
    res.status(500).json({
      success: false,
      error: 'Failed to check quota',
      details: result.error.message,
      screenshot: result.errorScreenshot ? Buffer.from(result.errorScreenshot).toString('base64') : null
    });
  } else {
    res.type('image/png');
    res.set('X-Proxy-Server', server);
    res.set('X-Quota-Exceeded', result.hasQuotaExceeded.toString());
    res.send(Buffer.from(result.screenshot));
  }
});


export default router;
