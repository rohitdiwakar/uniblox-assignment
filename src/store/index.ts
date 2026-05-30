import { AppStore } from './types';

// Singleton in-memory store. All state lives here for the lifetime of the process.
const store: AppStore = {
  products: new Map([
    ['P001', { id: 'P001', name: 'Wireless Headphones', price: 79.99 }],
    ['P002', { id: 'P002', name: 'Mechanical Keyboard', price: 129.99 }],
    ['P003', { id: 'P003', name: 'USB-C Hub', price: 49.99 }],
    ['P004', { id: 'P004', name: 'Webcam HD', price: 89.99 }],
    ['P005', { id: 'P005', name: 'Mouse Pad XL', price: 24.99 }],
  ]),
  carts: new Map(),
  orders: [],
  discountCodes: new Map(),
  config: {
    nthOrder: parseInt(process.env.NTH_ORDER ?? '5', 10),
    discountPercentage: parseInt(process.env.DISCOUNT_PERCENTAGE ?? '10', 10),
  },
};

export default store;

// Resets all mutable state — used in tests to ensure isolation between test cases.
export function resetStore(): void {
  store.carts.clear();
  store.orders.length = 0;
  store.discountCodes.clear();
}
