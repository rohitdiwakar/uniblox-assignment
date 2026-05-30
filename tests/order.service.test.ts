import { checkout, getStats, EmptyCartError } from '../src/services/order.service';
import { addItemToCart } from '../src/services/cart.service';
import { generateDiscountCode } from '../src/services/discount.service';
import { resetStore } from '../src/store';
import store from '../src/store';
import { CartNotFoundError } from '../src/services/cart.service';
import { InvalidDiscountCodeError, DiscountCodeAlreadyUsedError } from '../src/services/discount.service';
import { Order } from '../src/store/types';

beforeEach(() => {
  resetStore();
});

function seedOrders(count: number): void {
  for (let i = 0; i < count; i++) {
    const order: Order = {
      id: `seeded-${i}`,
      cartId: `cart-${i}`,
      items: [{ productId: 'P001', quantity: 1, unitPrice: 79.99 }],
      subtotal: 79.99,
      discountAmount: 0,
      total: 79.99,
      createdAt: new Date(),
    };
    store.orders.push(order);
  }
}

function buildCart(cartId: string): void {
  addItemToCart(cartId, 'P001', 2); // 2 × 79.99 = 159.98
  addItemToCart(cartId, 'P003', 1); // 1 × 49.99 = 49.99 → subtotal = 209.97
}

describe('checkout — no discount', () => {
  it('places an order and returns correct totals', () => {
    buildCart('cart-1');
    const { order } = checkout('cart-1');
    expect(order.subtotal).toBe(209.97);
    expect(order.discountAmount).toBe(0);
    expect(order.total).toBe(209.97);
    expect(order.discountCode).toBeUndefined();
  });

  it('persists the order in the store', () => {
    buildCart('cart-1');
    const { order } = checkout('cart-1');
    expect(store.orders.find((o) => o.id === order.id)).toBeDefined();
  });

  it('clears the cart after checkout', () => {
    buildCart('cart-1');
    checkout('cart-1');
    expect(store.carts.has('cart-1')).toBe(false);
  });

  it('throws CartNotFoundError for an unknown cartId', () => {
    expect(() => checkout('ghost-cart')).toThrow(CartNotFoundError);
  });

  it('throws EmptyCartError when cart has no items', () => {
    // Create an empty cart by adding then removing (simulate via store directly)
    store.carts.set('empty-cart', { id: 'empty-cart', items: [], createdAt: new Date() });
    expect(() => checkout('empty-cart')).toThrow(EmptyCartError);
  });
});

describe('checkout — with discount code', () => {
  it('applies the discount and records it on the order', () => {
    seedOrders(5);
    const { code } = generateDiscountCode(); // 10% code
    buildCart('cart-2');
    const { order } = checkout('cart-2', code);
    // 10% of 209.97 = 20.997 → rounded to 21.00
    expect(order.discountCode).toBe(code);
    expect(order.discountAmount).toBe(21.00);
    expect(order.total).toBe(188.97);
  });

  it('marks the discount code as used after checkout', () => {
    seedOrders(5);
    const { code } = generateDiscountCode();
    buildCart('cart-2');
    const { order } = checkout('cart-2', code);
    const storedCode = store.discountCodes.get(code)!;
    expect(storedCode.isUsed).toBe(true);
    expect(storedCode.orderId).toBe(order.id);
  });

  it('throws InvalidDiscountCodeError for a non-existent code', () => {
    buildCart('cart-2');
    expect(() => checkout('cart-2', 'FAKE-CODE')).toThrow(InvalidDiscountCodeError);
  });

  it('throws DiscountCodeAlreadyUsedError for a reused code', () => {
    seedOrders(5);
    const { code } = generateDiscountCode();
    buildCart('cart-a');
    checkout('cart-a', code);
    buildCart('cart-b');
    expect(() => checkout('cart-b', code)).toThrow(DiscountCodeAlreadyUsedError);
  });

  it('does not mutate the cart or persist the order when the code is invalid', () => {
    buildCart('cart-3');
    const orderCountBefore = store.orders.length;
    try { checkout('cart-3', 'INVALID'); } catch { /* expected */ }
    expect(store.orders.length).toBe(orderCountBefore);
    expect(store.carts.has('cart-3')).toBe(true); // cart must still exist
  });
});

describe('nth-order discount code generation', () => {
  it('returns an earnedDiscountCode on the nth order', () => {
    // Place 4 orders manually to get to count=4, then the 5th checkout triggers the code
    seedOrders(4);
    buildCart('cart-5');
    const { earnedDiscountCode } = checkout('cart-5');
    expect(earnedDiscountCode).toBeDefined();
    expect(earnedDiscountCode).toMatch(/^SAVE\d+-[A-Z0-9]{8}$/);
  });

  it('does not return earnedDiscountCode on a non-nth order', () => {
    seedOrders(3);
    buildCart('cart-4');
    const { earnedDiscountCode } = checkout('cart-4');
    expect(earnedDiscountCode).toBeUndefined();
  });

  it('the earned code is stored and usable at next checkout', () => {
    seedOrders(4);
    buildCart('cart-5');
    const { earnedDiscountCode } = checkout('cart-5');
    buildCart('cart-6');
    const { order } = checkout('cart-6', earnedDiscountCode);
    expect(order.discountCode).toBe(earnedDiscountCode);
    expect(order.discountAmount).toBeGreaterThan(0);
  });
});

describe('getStats', () => {
  it('returns zeroed stats when no orders exist', () => {
    const stats = getStats();
    expect(stats).toMatchObject({
      totalOrders: 0,
      totalItemsPurchased: 0,
      totalRevenue: 0,
      totalDiscountGiven: 0,
      discountCodes: { total: 0, used: 0, unused: 0 },
    });
  });

  it('correctly aggregates revenue and item counts across orders', () => {
    buildCart('cart-a');
    checkout('cart-a');
    buildCart('cart-b');
    checkout('cart-b');
    const stats = getStats();
    expect(stats.totalOrders).toBe(2);
    expect(stats.totalItemsPurchased).toBe(6); // 2 orders × (2+1 items)
    expect(stats.totalRevenue).toBeCloseTo(419.94, 2);
  });

  it('tracks used and unused discount codes correctly', () => {
    seedOrders(4);
    buildCart('cart-5');
    const { earnedDiscountCode } = checkout('cart-5'); // 5th order → code generated
    const stats = getStats();
    expect(stats.discountCodes.total).toBe(1);
    expect(stats.discountCodes.unused).toBe(1);
    expect(stats.discountCodes.used).toBe(0);

    buildCart('cart-6');
    checkout('cart-6', earnedDiscountCode);
    const stats2 = getStats();
    expect(stats2.discountCodes.used).toBe(1);
    expect(stats2.totalDiscountGiven).toBeGreaterThan(0);
  });
});
