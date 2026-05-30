import { Router, Request, Response, NextFunction } from 'express';
import { generateDiscountCode } from '../services/discount.service';
import { getStats } from '../services/order.service';

const router = Router();

// POST /admin/discount — manually generate a discount code if the condition is met
router.post('/admin/discount', (req: Request, res: Response, next: NextFunction) => {
  try {
    const discountCode = generateDiscountCode();
    res.status(201).json({ discountCode });
  } catch (err) {
    next(err);
  }
});

// GET /admin/stats — aggregate store-wide statistics
router.get('/admin/stats', (_req: Request, res: Response) => {
  const stats = getStats();
  res.json({ stats });
});

export default router;
