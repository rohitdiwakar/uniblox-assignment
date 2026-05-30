import { addItemToCart, getCart, clearCart, CartNotFoundError, ProductNotFoundError, InvalidQuantityError } from '../src/services/cart.service';
import { resetStore } from '../src/store';

beforeEach(() => {
  resetStore();
});

describe('addItemToCart', () => {
  it('creates a new cart and adds a valid product', () => {
    const cart = addItemToCart('cart-1', 'P001', 2);
    expect(cart.id).toBe('cart-1');
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({ productId: 'P001', quantity: 2, unitPrice: 79.99 });
  });

  it('merges quantity when the same product is added twice', () => {
    addItemToCart('cart-1', 'P001', 2);
    const cart = addItemToCart('cart-1', 'P001', 3);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(5);
  });

  it('adds distinct items as separate entries', () => {
    addItemToCart('cart-1', 'P001', 1);
    const cart = addItemToCart('cart-1', 'P002', 1);
    expect(cart.items).toHaveLength(2);
  });

  it('snapshots the unit price at add time', () => {
    const cart = addItemToCart('cart-1', 'P002', 1);
    // P002 is Mechanical Keyboard at 129.99
    expect(cart.items[0].unitPrice).toBe(129.99);
  });

  it('reuses an existing cart when the same cartId is used', () => {
    addItemToCart('cart-1', 'P001', 1);
    addItemToCart('cart-1', 'P003', 2);
    const cart = getCart('cart-1');
    expect(cart.items).toHaveLength(2);
  });

  it('throws ProductNotFoundError for an unknown productId', () => {
    expect(() => addItemToCart('cart-1', 'INVALID', 1)).toThrow(ProductNotFoundError);
  });

  it('throws InvalidQuantityError for quantity of zero', () => {
    expect(() => addItemToCart('cart-1', 'P001', 0)).toThrow(InvalidQuantityError);
  });

  it('throws InvalidQuantityError for a negative quantity', () => {
    expect(() => addItemToCart('cart-1', 'P001', -3)).toThrow(InvalidQuantityError);
  });

  it('throws InvalidQuantityError for a non-integer quantity', () => {
    expect(() => addItemToCart('cart-1', 'P001', 1.5)).toThrow(InvalidQuantityError);
  });
});

describe('getCart', () => {
  it('returns the cart when it exists', () => {
    addItemToCart('cart-1', 'P001', 1);
    const cart = getCart('cart-1');
    expect(cart.id).toBe('cart-1');
  });

  it('throws CartNotFoundError for a non-existent cartId', () => {
    expect(() => getCart('ghost-cart')).toThrow(CartNotFoundError);
  });
});

describe('clearCart', () => {
  it('removes the cart from the store', () => {
    addItemToCart('cart-1', 'P001', 1);
    clearCart('cart-1');
    expect(() => getCart('cart-1')).toThrow(CartNotFoundError);
  });

  it('is a no-op for a cartId that does not exist', () => {
    expect(() => clearCart('ghost-cart')).not.toThrow();
  });
});
