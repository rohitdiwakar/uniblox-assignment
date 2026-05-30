import {
  generateDiscountCode,
  validateDiscountCode,
  markDiscountCodeUsed,
  getAllDiscountCodes,
  DiscountConditionNotMetError,
  InvalidDiscountCodeError,
  DiscountCodeAlreadyUsedError,
} from '../src/services/discount.service';
import { resetStore } from '../src/store';
import store from '../src/store';
import { Order } from '../src/store/types';

beforeEach(() => {
  resetStore();
});

// Seed a given number of dummy completed orders directly into the store
function seedOrders(count: number): void {
  for (let i = 0; i < count; i++) {
    const order: Order = {
      id: `order-${i}`,
      cartId: `cart-${i}`,
      items: [],
      subtotal: 100,
      discountAmount: 0,
      total: 100,
      createdAt: new Date(),
    };
    store.orders.push(order);
  }
}

describe('generateDiscountCode', () => {
  it('throws when no orders have been placed', () => {
    expect(() => generateDiscountCode()).toThrow(DiscountConditionNotMetError);
  });

  it('throws when order count is not a multiple of nthOrder', () => {
    seedOrders(3); // nthOrder default is 5
    expect(() => generateDiscountCode()).toThrow(DiscountConditionNotMetError);
  });

  it('succeeds when order count equals nthOrder', () => {
    seedOrders(5);
    const code = generateDiscountCode();
    expect(code.isUsed).toBe(false);
    expect(code.percentage).toBe(store.config.discountPercentage);
    expect(code.code).toMatch(/^SAVE\d+-[A-Z0-9]{8}$/);
  });

  it('succeeds when order count is a higher multiple of nthOrder', () => {
    seedOrders(10);
    const code = generateDiscountCode();
    expect(code).toBeDefined();
  });

  it('adds the generated code to the store', () => {
    seedOrders(5);
    const code = generateDiscountCode();
    expect(store.discountCodes.has(code.code)).toBe(true);
  });

  it('generates unique codes on successive calls', () => {
    seedOrders(5);
    const code1 = generateDiscountCode();
    const code2 = generateDiscountCode();
    expect(code1.code).not.toBe(code2.code);
  });
});

describe('validateDiscountCode', () => {
  it('returns the code when it is valid and unused', () => {
    seedOrders(5);
    const generated = generateDiscountCode();
    const validated = validateDiscountCode(generated.code);
    expect(validated.code).toBe(generated.code);
  });

  it('throws InvalidDiscountCodeError for an unknown code', () => {
    expect(() => validateDiscountCode('FAKE-CODE')).toThrow(InvalidDiscountCodeError);
  });

  it('throws DiscountCodeAlreadyUsedError for a code that has been used', () => {
    seedOrders(5);
    const generated = generateDiscountCode();
    markDiscountCodeUsed(generated.code, 'order-999');
    expect(() => validateDiscountCode(generated.code)).toThrow(DiscountCodeAlreadyUsedError);
  });
});

describe('markDiscountCodeUsed', () => {
  it('marks the code as used and records the orderId', () => {
    seedOrders(5);
    const generated = generateDiscountCode();
    markDiscountCodeUsed(generated.code, 'order-abc');
    const updated = store.discountCodes.get(generated.code)!;
    expect(updated.isUsed).toBe(true);
    expect(updated.orderId).toBe('order-abc');
    expect(updated.usedAt).toBeInstanceOf(Date);
  });

  it('throws InvalidDiscountCodeError when marking an unknown code', () => {
    expect(() => markDiscountCodeUsed('GHOST', 'order-1')).toThrow(InvalidDiscountCodeError);
  });
});

describe('getAllDiscountCodes', () => {
  it('returns an empty array when no codes exist', () => {
    expect(getAllDiscountCodes()).toEqual([]);
  });

  it('returns all codes including used and unused', () => {
    seedOrders(5);
    generateDiscountCode();
    generateDiscountCode();
    expect(getAllDiscountCodes()).toHaveLength(2);
  });
});
