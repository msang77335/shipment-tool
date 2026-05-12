import { aftershipTrackingShipment } from '../helpers/trackingShipment/aftershipTrackingShipment';
import { Request, Response, Router } from 'express';
import { is4PX, isAfterShip, isASENDIA, isAustraliaPost, isBestExpress, isCanadaPost, isEVRI, isFedEx, isGiaoHangNhanh, isGofo, isJTExpress, isOnTrac, isSingPost, isSPX, isSTALLION, isUNIUNI, isUPS, isUSPS, isViettelPost, isVnPost, isYunExpress, isYW } from '../helpers';
import { trackingShipment } from '../helpers/trackingShipment';
import { australiaPostTrackingShipment } from '../helpers/trackingShipment/australiaTrackingShipment';
import { bestExpressTrackingShipment } from '../helpers/trackingShipment/bestExpressTrackingShipment';
import { evriTrackingShipment } from '../helpers/trackingShipment/evriTrackingShipment';
import { fedexTrackingShipment } from '../helpers/trackingShipment/fedexTrackingShipment';
import { gofoTrackingShipment } from '../helpers/trackingShipment/gofoTrackingShipment';
import { stallionTrackingShipment } from '../helpers/trackingShipment/stallionTrackingShipment';
import { jntShipmentTrackingShipment } from '../helpers/trackingShipment/jntTrackingShipment';
import { singPostTrackingShipment } from '../helpers/trackingShipment/singPostTrackingShipment';
import { uniTrackingShipment } from '../helpers/trackingShipment/uniTrackingShipment';
import { upsTrackingShipment } from '../helpers/trackingShipment/upsTrackingShipment';
import { uspsTrackingShipment } from '../helpers/trackingShipment/uspsTrackingShipment';
import { viettelPostTrackingShipment } from '../helpers/trackingShipment/viettelPostTrackingShipment';
import { vnPostTrackingShipment } from '../helpers/trackingShipment/vnPostTrackingShipment';
import { ywTrackingShipment } from '../helpers/trackingShipment/ywTrackingShipment';
import { fourPXTrackingShipment } from '../helpers/trackingShipment/4pxTrackingShipment';

const router = Router();

// J&T request queue: stagger concurrent requests by 13s each
let jntActiveCount = 0;
const JNT_STAGGER_DELAY_MS = 13000;

async function withJntQueue<T>(fn: () => Promise<T>): Promise<T> {
  const waitMs = jntActiveCount * JNT_STAGGER_DELAY_MS;
  jntActiveCount++;
  try {
    if (waitMs > 0) {
      console.log(`⏳ [JNT QUEUE] Queued request #${jntActiveCount}, waiting ${waitMs / 1000}s before starting...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    return await fn();
  } finally {
    jntActiveCount--;
  }
}

interface TrackingQuery {
  provider: string;
  codes?: string;
  bankAccountName?: string;
}

type TrackingHandler = ({ codes, provider, bankAccountName }: { codes: string; provider: string; bankAccountName?: string }) => Promise<{ status: string; buffer: Buffer }>;

const createProviderHandler = (predicate: (p: string) => boolean, handler: TrackingHandler) => ({
  check: predicate,
  handle: handler
});

const handlers: Array<{ check: (p: string) => boolean; handle: TrackingHandler }> = [
  createProviderHandler(isViettelPost, ({ codes }) => viettelPostTrackingShipment(codes)),
  createProviderHandler(isSPX, ({ codes, provider}) => trackingShipment(`https://spx.vn/track?${codes}`, provider)),
  createProviderHandler(isGiaoHangNhanh, ({ codes, provider }) => trackingShipment(`https://donhang.ghn.vn/?order_code=${codes}`, provider)),
  createProviderHandler(isYunExpress, ({ codes, provider }) => trackingShipment(`https://www.yuntrack.com/parcelTracking?id=${codes}`, provider)),
  createProviderHandler(isOnTrac, ({ codes, provider }) => trackingShipment(`https://www.ontrac.com/tracking/?number=${codes}`, provider)),
  createProviderHandler(isYW, ({ codes }) => ywTrackingShipment({ codes })),
  createProviderHandler(isJTExpress, ({ codes, bankAccountName }) => withJntQueue(() => jntShipmentTrackingShipment({ codes, bankAccountName }))),
  createProviderHandler(isUSPS, ({ codes }) => uspsTrackingShipment({ codes })),
  createProviderHandler(isVnPost, ({ codes }) => vnPostTrackingShipment(codes)),
  createProviderHandler(isBestExpress, ({ codes }) => bestExpressTrackingShipment(codes)),
  createProviderHandler(isUNIUNI, ({ codes }) => uniTrackingShipment({ codes })),
  createProviderHandler(isEVRI, ({ codes }) => evriTrackingShipment({ codes })),
  createProviderHandler(isASENDIA, ({ codes, provider }) => trackingShipment(`https://track.asendia.com/track/${codes}`, provider)),
  createProviderHandler(isSingPost, ({ codes }) => singPostTrackingShipment({ codes })),
  createProviderHandler(isAfterShip, ({ codes, provider }) => aftershipTrackingShipment({ codes, provider })),
  createProviderHandler(isGofo, ({ codes }) => gofoTrackingShipment({ codes })),
  createProviderHandler(isSTALLION, ({ codes }) => stallionTrackingShipment({ codes })),
  createProviderHandler(isAustraliaPost, ({ codes }) => australiaPostTrackingShipment(codes)),
  createProviderHandler(isUPS, ({ codes }) => upsTrackingShipment({ codes })),
  createProviderHandler(isFedEx, ({ codes }) => fedexTrackingShipment({ codes })),
  createProviderHandler(isCanadaPost, ({ codes }) => trackingShipment(`https://www.canadapost-postescanada.ca/track-reperage/en/details/${codes}`, 'Canada Post')),
  createProviderHandler(is4PX, ({ codes }) => fourPXTrackingShipment({ codes })),
];

async function getTrackingResult({ codes, provider, bankAccountName }: { codes: string; provider: string; bankAccountName?: string }): Promise<{ status: string; buffer: Buffer } | null> {
  const handlerConfig = handlers.find(h => h.check(provider));
  if (handlerConfig) {
    return handlerConfig.handle({ codes, provider, bankAccountName });
  }
  return null;
}

function sendSuccessResponse(res: Response, result: { status: string; buffer: Buffer }, duration: number, provider: string): void {
  console.log(`✅ [TRACKING IMAGE] Completed successfully in ${duration}ms`);
  console.log(`📊 [TRACKING IMAGE] Provider: ${provider}, Status: ${result.status}`);
  console.log(`🖼️ [TRACKING IMAGE] Image size: ${result.buffer.length} bytes`);

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Length', result.buffer.length.toString());
  res.setHeader('X-Tracking-Status', result.status);
  res.setHeader('X-Processing-Time', `${duration}ms`);
  res.send(result.buffer);
}

function sendErrorResponse(res: Response, statusCode: number, error: string, message?: string, duration?: number): void {
  const responseBody: any = { success: false, error };
  if (message) responseBody.message = message;
  if (duration) responseBody.duration = `${duration}ms`;
  res.status(statusCode).json(responseBody);
}

// POST /api/v1/tracking - Get tracking image as binary with metadata in headers
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  console.log(`🚀 [TRACKING IMAGE] Starting request at ${new Date().toISOString()}`);

  try {
    const { provider, codes, bankAccountName }: TrackingQuery = req.body;

    if (!provider || !codes) {
      console.log(`❌ [TRACKING IMAGE] Missing provider or codes parameter`);
      sendErrorResponse(res, 400, 'Provider and codes parameters are required');
      return;
    }

    console.log(`📦 [TRACKING IMAGE] Processing ${provider} tracking code: ${codes} bank account: ${bankAccountName || 'N/A'}`);

    const result = await getTrackingResult({ provider, codes, bankAccountName });

    if (!result) {
      console.log(`❌ [TRACKING IMAGE] Unsupported provider: ${provider}`);
      sendErrorResponse(res, 400, `Provider '${provider}' is not supported yet`);
      return;
    }

    const duration = Date.now() - startTime;
    sendSuccessResponse(res, result, duration, provider);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`💥 [TRACKING IMAGE] Error occurred after ${duration}ms:`, error);
    console.error(`💥 [TRACKING IMAGE] Error stack:`, error.stack);
    sendErrorResponse(res, 500, 'Failed to get tracking image', error.message, duration);
  }
});

export default router;
