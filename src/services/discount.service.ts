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

export class DiscountAlreadyGeneratedError extends Error {
  constructor() {
    super('A discount code has already been generated for this order milestone.');
    this.name = 'DiscountAlreadyGeneratedError';
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

function buildCode(): DiscountCode {
  const { discountPercentage } = store.config;
  const code = `SAVE${discountPercentage}-${uuidv4().slice(0, 8).toUpperCase()}`;
  const discountCode: DiscountCode = {
    code,
    percentage: discountPercentage,
    isUsed: false,
    createdAt: new Date(),
  };
  store.discountCodes.set(code, discountCode);
  store.config.lastCodeGeneratedAtOrder = store.orders.length;
  return discountCode;
}

/**
 * Admin-triggered code generation.
 * Requires: order count is a non-zero multiple of nthOrder AND no code has been
 * issued for this milestone yet.
 */
export function generateDiscountCode(): DiscountCode {
  const { nthOrder, lastCodeGeneratedAtOrder } = store.config;
  const orderCount = store.orders.length;

  if (orderCount === 0 || orderCount % nthOrder !== 0) {
    throw new DiscountConditionNotMetError(nthOrder);
  }

  if (lastCodeGeneratedAtOrder === orderCount) {
    throw new DiscountAlreadyGeneratedError();
  }

  return buildCode();
}

/**
 * Issues a reward discount code automatically when the nth order threshold is hit.
 * Called by OrderService after checkout — the threshold check happens there.
 */
export function issueRewardCode(): DiscountCode {
  return buildCode();
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
