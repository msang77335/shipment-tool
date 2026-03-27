import { Request, Response, Router } from 'express';
import trackingRoutes from './trackingRoutes';
import checkShopRoutes from './checkShopRoutes';
import proxyRoutes from './proxyRoutes';

const router = Router();

// Mount route handlers
router.use('/tracking', trackingRoutes);
router.use('/check-shop', checkShopRoutes);
router.use('/proxy', proxyRoutes);

// Default API route
router.get('/', (req: Request, res: Response): void => {
  res.json({
    success: true,
    message: 'Express API Server is running!',
    endpoints: {
      health: '/health',
      tracking: '/api/v1/tracking',
      checkShop: '/api/v1/check-shop',
      proxy: '/api/v1/proxy'
    }
  });
});

export default router;