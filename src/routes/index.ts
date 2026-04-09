import { Request, Response, Router } from 'express';
import trackingRoutes from './trackingRoutes';
import checkShopRoutes from './checkShopRoutes';
import proxyRoutes from './proxyRoutes';
import jntRoutes from './jntRoutes';

const router = Router();

// Mount route handlers
router.use('/tracking', trackingRoutes);
router.use('/check-shop', checkShopRoutes);
router.use('/proxy', proxyRoutes);
router.use('/jnt', jntRoutes);

// Default API route
router.get('/', (req: Request, res: Response): void => {
  res.json({
    success: true,
    message: 'Express API Server is running!',
    endpoints: {
      health: '/health',
      tracking: '/api/v1/tracking',
      checkShop: '/api/v1/check-shop',
      proxy: '/api/v1/proxy',
      jnt: '/api/v1/jnt'
    }
  });
});

export default router;