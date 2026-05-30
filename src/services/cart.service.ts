import { v4 as uuidv4 } from 'uuid';
import store from '../store';
import { Cart, CartItem } from '../store/types';

export class CartNotFoundError extends Error {
  constructor(cartId: string) {
    super(`Cart '${cartId}' not found`);
    this.name = 'CartNotFoundError';
  }
}

export class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Product '${productId}' not found`);
    this.name = 'ProductNotFoundError';
  }
}

export class InvalidQuantityError extends Error {
  constructor() {
    super('Quantity must be a positive integer');
    this.name = 'InvalidQuantityError';
  }
}

/**
 * Adds a product to a cart. Creates the cart if it doesn't exist yet.
 * If the same product is already in the cart, quantity is merged rather than duplicated.
 * Unit price is snapshotted at add time — later catalog price changes won't affect this cart.
 */
export function addItemToCart(cartId: string, productId: string, quantity: number): Cart {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new InvalidQuantityError();
  }

  const product = store.products.get(productId);
  if (!product) {
    throw new ProductNotFoundError(productId);
  }

  let cart = store.carts.get(cartId);
  if (!cart) {
    cart = { id: cartId, items: [], createdAt: new Date() };
    store.carts.set(cartId, cart);
  }

  const existing = cart.items.find((i) => i.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    const item: CartItem = { productId, quantity, unitPrice: product.price };
    cart.items.push(item);
  }

  return cart;
}

export function getCart(cartId: string): Cart {
  const cart = store.carts.get(cartId);
  if (!cart) throw new CartNotFoundError(cartId);
  return cart;
}

export function clearCart(cartId: string): void {
  store.carts.delete(cartId);
}

export function createCartId(): string {
  return uuidv4();
}
