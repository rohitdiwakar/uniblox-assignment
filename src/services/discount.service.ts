import { v4 as uuidv4 } from 'uuid';
import store from '../store';
import { DiscountCode } from '../store/types';

export class DiscountConditionNotMetError extends Error {
  constructor(nthOrder: number) {
    super(
      `Discount code can only be generated after every ${nthOrder}th order. ` +
        `Current order count does not satisfy this condition.`
    );
    this.name = 'DiscountConditionNotMetError';
  }
}

export class InvalidDiscountCodeError extends Error {
  constructor(code: string) {
    super(`Discount code '${code}' is not valid`);
    this.name = 'InvalidDiscountCodeError';
  }
}

export class DiscountCodeAlreadyUsedError extends Error {
  constructor(code: string) {
    super(`Discount code '${code}' has already been used`);
    this.name = 'DiscountCodeAlreadyUsedError';
  }
}

/**
 * Generates a human-readable discount code tied to the current config percentage.
 * Only succeeds if total orders placed is a non-zero multiple of nthOrder,
 * ensuring the condition "every nth order earns a code" is enforced.
 */
export function generateDiscountCode(): DiscountCode {
  const { nthOrder, discountPercentage } = store.config;
  const orderCount = store.orders.length;

  if (orderCount === 0 || orderCount % nthOrder !== 0) {
    throw new DiscountConditionNotMetError(nthOrder);
  }

  const code = `SAVE${discountPercentage}-${uuidv4().slice(0, 8).toUpperCase()}`;
  const discountCode: DiscountCode = {
    code,
    percentage: discountPercentage,
    isUsed: false,
    createdAt: new Date(),
  };

  store.discountCodes.set(code, discountCode);
  return discountCode;
}

/**
 * Internal helper called at checkout to auto-generate a code when the nth order threshold is hit.
 * Unlike generateDiscountCode(), this does not enforce the condition check — the caller
 * (OrderService) is responsible for checking the threshold before calling this.
 */
export function generateDiscountCodeInternal(): DiscountCode {
  const { discountPercentage } = store.config;
  const code = `SAVE${discountPercentage}-${uuidv4().slice(0, 8).toUpperCase()}`;
  const discountCode: DiscountCode = {
    code,
    percentage: discountPercentage,
    isUsed: false,
    createdAt: new Date(),
  };
  store.discountCodes.set(code, discountCode);
  return discountCode;
}

export function validateDiscountCode(code: string): DiscountCode {
  const discountCode = store.discountCodes.get(code);
  if (!discountCode) throw new InvalidDiscountCodeError(code);
  if (discountCode.isUsed) throw new DiscountCodeAlreadyUsedError(code);
  return discountCode;
}

export function markDiscountCodeUsed(code: string, orderId: string): void {
  const discountCode = store.discountCodes.get(code);
  if (!discountCode) throw new InvalidDiscountCodeError(code);
  discountCode.isUsed = true;
  discountCode.usedAt = new Date();
  discountCode.orderId = orderId;
}

export function getAllDiscountCodes(): DiscountCode[] {
  return Array.from(store.discountCodes.values());
}
