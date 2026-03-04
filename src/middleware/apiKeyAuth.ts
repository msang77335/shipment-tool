import { Request, Response, NextFunction } from 'express';
import { env } from '../helpers';

/**
 * API Key Authentication Middleware
 * Validates X-API-Key header against environment variable
 */
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction): void => {
  // Skip authentication if no API key is configured
  if (!env.xApiKey) {
    console.log('⚠️ [API KEY AUTH] No API key configured, skipping authentication');
    next();
    return;
  }

  // Get API key from request headers
  const apiKey = req.headers['x-api-key'] as string;

  // Check if API key is provided
  if (!apiKey) {
    console.log('❌ [API KEY AUTH] Missing API key in request');
    res.status(401).json({
      success: false,
      error: 'API key is required. Please provide X-API-Key header.'
    });
    return;
  }

  // Validate API key
  if (apiKey !== env.xApiKey) {
    console.log('❌ [API KEY AUTH] Invalid API key provided');
    res.status(403).json({
      success: false,
      error: 'Invalid API key.'
    });
    return;
  }

  // API key is valid, continue
  console.log('✅ [API KEY AUTH] Valid API key, request authorized');
  next();
};

/**
 * Optional API Key Authentication Middleware
 * Logs API key presence but doesn't enforce it
 * Useful for gradual migration or analytics
 */
export const optionalApiKeyAuth = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;

  if (apiKey && env.xApiKey && apiKey === env.xApiKey) {
    console.log('✅ [API KEY AUTH] Authenticated request with valid API key');
    // Add flag to request for tracking authenticated requests
    (req as any).isAuthenticated = true;
  } else if (apiKey) {
    console.log('⚠️ [API KEY AUTH] Request with invalid API key');
    (req as any).isAuthenticated = false;
  } else {
    console.log('ℹ️ [API KEY AUTH] Unauthenticated request (no API key provided)');
    (req as any).isAuthenticated = false;
  }

  next();
};
