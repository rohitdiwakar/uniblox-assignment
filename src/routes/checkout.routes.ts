import { Router, Request, Response, NextFunction } from 'express';
import { checkout } from '../services/order.service';

const router = Router();

// POST /checkout — place an order; optionally apply a discount code
router.post('/checkout', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cartId, discountCode } = req.body;

    if (!cartId) {
      res.status(400).json({ error: 'cartId is required' });
      return;
    }

    const result = checkout(cartId, discountCode);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
