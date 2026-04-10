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
import { PhoneBruteForceFinder } from '../helpers/jnt/scanPhone';
import { scanPhoneJobManager } from '../helpers/jnt/scanPhoneJobManager';
import { trackingHistManager } from '../helpers/jnt/trackingHist';

const router = Router();

/**
 * GET /api/jnt/phone
 * Get all phone numbers in the pool
 */
router.get('/phone', (req: Request, res: Response) => {
  try {
    const phones = phoneManager.getAllPhones();
    return res.json({
      status: 'success',
      data: phones,
      count: phones.length
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
 * POST /api/jnt/phone
 * Add phone number(s) to the pool
 * Body: { sellerPhone: [ { name: string, phones: string[] } ] }
 */
router.post('/phone', (req: Request, res: Response) => {
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

    const addedPhones = phoneManager.addPhones(sellerPhone);

    return res.json({
      status: 'success',
      data: addedPhones,
      addedCount: addedPhones.length,
      totalPhones: phoneManager.getAllPhones().length
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
 * POST /api/jnt/scan-phone
 * Start background brute-force scan for valid phone number
 * Body: { codes: string }
 * Returns: { status: 'success', jobId: string, job: ScanPhoneJob }
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
    const job = scanPhoneJobManager.createJob(codes);

    // Start background processing (don't await)
    (async () => {
      try {
        scanPhoneJobManager.setProcessing(job.id);

        // Get all phones from the pool
        const allPhones = phoneManager.getAllPhones();
        const phoneSet = new Set<string>();

        // Flatten all phones from all name groups (auto-remove duplicates)
        allPhones.forEach(group => {
          group.phones.forEach(phone => phoneSet.add(phone));
        });

        const phoneList = Array.from(phoneSet);

        if (phoneList.length === 0) {
          scanPhoneJobManager.setError(job.id, 'No phones available in pool');
          return;
        }

        const finder = new PhoneBruteForceFinder();

        // Run the scan
        const result = await finder.findPhone(codes, phoneList, startFrom);

        // Save result
        scanPhoneJobManager.setSuccess(job.id, result);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        scanPhoneJobManager.setError(job.id, errorMsg);
        console.error(`❌ [JNT] Error in background scan job ${job.id}:`, error);
      }
    })();

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
 * GET /api/jnt/scan-phone/:id
 * Get status and result of a scan phone job
 * Returns: ScanPhoneJob with status and result
 */
router.get('/scan-phone/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Job ID is required'
      });
    }

    const job = scanPhoneJobManager.getJob(id as string);

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
 * GET /api/jnt/scan-phone
 * List recent scan phone jobs
 * Query: ?limit=100
 */
router.get('/scan-phone', (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number.parseInt(req.query.limit as string) || 100, 500);
    const jobs = scanPhoneJobManager.listJobs(limit);

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
 * GET /api/jnt/tracking-history
 * Get tracking history for J&T and AfterShip
 * Query: ?site=J&T or ?site=AfterShip (optional)
 */
router.get('/tracking-history', (req: Request, res: Response) => {
  try {
    const { site } = req.query;
    const validSites = ["J&T", "AfterShip"];
    let trackingHist;

    if (site && typeof site === 'string') {
      if (!validSites.includes(site)) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid site parameter. Valid values are: ${validSites.join(', ')}`
        });
      }
      trackingHist = trackingHistManager.getAllHist({ site: site as "J&T" | "AfterShip" });
    } else {
      trackingHist = trackingHistManager.getAllHist({});
    }

    return res.json({
      status: 'success',
      data: trackingHist,
      count: trackingHist.length
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
 * DELETE /api/jnt/tracking-history
 * Clear all tracking history records
 */
router.delete('/tracking-history', (req: Request, res: Response) => {
  try {
    trackingHistManager.clearHist();
    return res.json({
      status: 'success',
      message: 'Tracking history cleared'
    });
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

export default router;
