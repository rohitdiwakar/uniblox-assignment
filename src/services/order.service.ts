import { v4 as uuidv4 } from 'uuid';
import store from '../store';
import { Order } from '../store/types';
import { clearCart, CartNotFoundError } from './cart.service';
import { validateDiscountCode, markDiscountCodeUsed, issueRewardCode } from './discount.service';

const round2 = (n: number): number => parseFloat(n.toFixed(2));

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
    list: Array<{ code: string; percentage: number; isUsed: boolean; createdAt: Date; usedAt?: Date }>;
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
  const discountAmount = validCode ? round2((subtotal * validCode.percentage) / 100) : 0;
  const total = round2(subtotal - discountAmount);

  const order: Order = {
    id: uuidv4(),
    cartId,
    items: [...cart.items],
    subtotal: round2(subtotal),
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
  const earnedDiscountCode = isNthOrder ? issueRewardCode() : undefined;

  clearCart(cartId);

  return { order, earnedDiscountCode: earnedDiscountCode?.code };
}

export function getStats(): StoreStats {
  const codes = Array.from(store.discountCodes.values());

  const totalItemsPurchased = store.orders.reduce(
    (sum, order) => sum + order.items.reduce((s, item) => s + item.quantity, 0),
    0
  );

  const totalRevenue = round2(store.orders.reduce((sum, order) => sum + order.total, 0));
  const totalDiscountGiven = round2(store.orders.reduce((sum, order) => sum + order.discountAmount, 0));

  return {
    totalOrders: store.orders.length,
    totalItemsPurchased,
    totalRevenue,
    totalDiscountGiven,
    discountCodes: {
      total: codes.length,
      used: codes.filter((c) => c.isUsed).length,
      unused: codes.filter((c) => !c.isUsed).length,
      list: codes.map(({ code, percentage, isUsed, createdAt, usedAt }) => ({
        code,
        percentage,
        isUsed,
        createdAt,
        usedAt,
      })),
    },
  };
}
