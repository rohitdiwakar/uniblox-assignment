import { v4 as uuidv4 } from 'uuid';
import store from '../store';
import { Order } from '../store/types';
import { clearCart, CartNotFoundError } from './cart.service';
import { validateDiscountCode, markDiscountCodeUsed, generateDiscountCodeInternal } from './discount.service';

export class EmptyCartError extends Error {
  constructor(cartId: string) {
    super(`Cart '${cartId}' is empty — add items before checking out`);
    this.name = 'EmptyCartError';
  }
}

export interface CheckoutResult {
  order: Order;
  earnedDiscountCode?: string; // present when this order was the nth order
}

export interface StoreStats {
  totalOrders: number;
  totalItemsPurchased: number;
  totalRevenue: number;
  totalDiscountGiven: number;
  discountCodes: {
    total: number;
    used: number;
    unused: number;
  };
}

/**
 * Converts a cart into a placed order.
 *
 * Flow:
 *  1. Validate cart exists and is non-empty.
 *  2. If a discount code is provided, validate it (throws on invalid/used).
 *  3. Compute subtotal, discount amount, and final total.
 *  4. Persist the order and mark the discount code as used.
 *  5. If this is the nth order, auto-generate a new discount code for the customer.
 *  6. Clear the cart.
 */
export function checkout(cartId: string, discountCode?: string): CheckoutResult {
  const cart = store.carts.get(cartId);
  if (!cart) throw new CartNotFoundError(cartId);
  if (cart.items.length === 0) throw new EmptyCartError(cartId);

  // Validate discount code upfront so we fail before mutating any state
  const validCode = discountCode ? validateDiscountCode(discountCode) : undefined;

  const subtotal = cart.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountAmount = validCode ? parseFloat(((subtotal * validCode.percentage) / 100).toFixed(2)) : 0;
  const total = parseFloat((subtotal - discountAmount).toFixed(2));

  const order: Order = {
    id: uuidv4(),
    cartId,
    items: [...cart.items],
    subtotal: parseFloat(subtotal.toFixed(2)),
    discountCode: validCode?.code,
    discountAmount,
    total,
    createdAt: new Date(),
  };

  store.orders.push(order);

  if (validCode) {
    markDiscountCodeUsed(validCode.code, order.id);
  }

  // Check if this completed order hits the nth-order threshold
  const isNthOrder = store.orders.length % store.config.nthOrder === 0;
  const earnedDiscountCode = isNthOrder ? generateDiscountCodeInternal() : undefined;

  clearCart(cartId);

  return { order, earnedDiscountCode: earnedDiscountCode?.code };
}

export function getStats(): StoreStats {
  const codes = Array.from(store.discountCodes.values());

  const totalItemsPurchased = store.orders.reduce(
    (sum, order) => sum + order.items.reduce((s, item) => s + item.quantity, 0),
    0
  );

  const totalRevenue = parseFloat(
    store.orders.reduce((sum, order) => sum + order.total, 0).toFixed(2)
  );

  const totalDiscountGiven = parseFloat(
    store.orders.reduce((sum, order) => sum + order.discountAmount, 0).toFixed(2)
  );

  return {
    totalOrders: store.orders.length,
    totalItemsPurchased,
    totalRevenue,
    totalDiscountGiven,
    discountCodes: {
      total: codes.length,
      used: codes.filter((c) => c.isUsed).length,
      unused: codes.filter((c) => !c.isUsed).length,
    },
  };
}
