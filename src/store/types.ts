export interface Product {
  id: string;
  name: string;
  price: number; // in USD, two decimal places
}

export interface CartItem {
  productId: string;
  quantity: number;
  unitPrice: number; // price snapshot at add-to-cart time
}

export interface Cart {
  id: string;
  items: CartItem[];
  createdAt: Date;
}

export interface Order {
  id: string;
  cartId: string;
  items: CartItem[];
  subtotal: number;
  discountCode?: string;
  discountAmount: number;
  total: number;
  createdAt: Date;
}

export interface DiscountCode {
  code: string;
  percentage: number;
  isUsed: boolean;
  createdAt: Date;
  usedAt?: Date;
  orderId?: string; // the order that consumed this code
}

export interface StoreConfig {
  nthOrder: number;          // generate a discount code every N orders
  discountPercentage: number; // the discount amount (e.g. 10 = 10%)
}

export interface AppStore {
  products: Map<string, Product>;
  carts: Map<string, Cart>;
  orders: Order[];
  discountCodes: Map<string, DiscountCode>;
  config: StoreConfig;
}
