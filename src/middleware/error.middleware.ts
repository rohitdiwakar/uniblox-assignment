import { Request, Response, NextFunction } from 'express';
import { CartNotFoundError, ProductNotFoundError, InvalidQuantityError } from '../services/cart.service';
import { DiscountConditionNotMetError, InvalidDiscountCodeError, DiscountCodeAlreadyUsedError } from '../services/discount.service';
import { EmptyCartError } from '../services/order.service';

// Maps known domain errors to appropriate HTTP status codes.
// Unrecognised errors fall through to a generic 500.
export function errorMiddleware(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (
    err instanceof CartNotFoundError ||
    err instanceof ProductNotFoundError ||
    err instanceof InvalidDiscountCodeError
  ) {
    res.status(404).json({ error: err.message });
    return;
  }

  if (
    err instanceof InvalidQuantityError ||
    err instanceof EmptyCartError ||
    err instanceof DiscountCodeAlreadyUsedError ||
    err instanceof DiscountConditionNotMetError
  ) {
    res.status(400).json({ error: err.message });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
