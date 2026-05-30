# UniBlox E-Commerce API

A RESTful e-commerce backend with cart management, checkout, and a discount system. Built with TypeScript and Express. Uses an in-memory store — no database required.

## Features

- Add products to a cart (price snapshotted at add time)
- Checkout with optional discount code
- Discount system: every Nth order automatically earns a coupon code for X% off
- Admin endpoints: generate discount codes and view store-wide statistics
- Minimal frontend included (served by Express)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| Tests | Jest + ts-jest |
| Store | In-memory (module singleton) |

---

## Setup

### Prerequisites
- Node.js 18+
- npm 9+

### Install

```bash
git clone https://github.com/rohitdiwakar/uniblox-assignment.git
cd uniblox-assignment
npm install
```

### Run (development)

```bash
npm run dev
```

Server starts on [http://localhost:3000](http://localhost:3000).  
Open the URL in a browser to use the frontend.

### Run (production build)

```bash
npm run build
npm start
```

### Configuration

Set these environment variables to override defaults:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `NTH_ORDER` | `5` | Every Nth order earns a discount code |
| `DISCOUNT_PERCENTAGE` | `10` | Discount percentage (e.g. `10` = 10% off) |

Example:
```bash
NTH_ORDER=3 DISCOUNT_PERCENTAGE=15 npm run dev
```

---

## Running Tests

```bash
npm test
```

43 unit tests covering all core business logic across CartService, DiscountService, and OrderService.

---

## API Reference

### Products

#### `GET /products`
Returns the list of available products.

**Response**
```json
{
  "products": [
    { "id": "P001", "name": "Wireless Headphones", "price": 79.99 }
  ]
}
```

---

### Cart

#### `POST /cart`
Creates a new cart and returns its ID.

**Response** `201`
```json
{ "cartId": "uuid-string" }
```

#### `POST /cart/:cartId/items`
Adds a product to the cart. Creates the cart if it does not exist. Adding the same product twice merges the quantity.

**Request body**
```json
{ "productId": "P001", "quantity": 2 }
```

**Response** `200`
```json
{ "cart": { "id": "...", "items": [...], "createdAt": "..." } }
```

#### `GET /cart/:cartId`
Returns the current state of a cart.

---

### Checkout

#### `POST /checkout`
Places an order. Optionally applies a discount code.

**Request body**
```json
{
  "cartId": "uuid-string",
  "discountCode": "SAVE10-ABCD1234"
}
```

**Response** `201`
```json
{
  "order": {
    "id": "...",
    "items": [...],
    "subtotal": 209.97,
    "discountCode": "SAVE10-ABCD1234",
    "discountAmount": 21.00,
    "total": 188.97,
    "createdAt": "..."
  },
  "earnedDiscountCode": "SAVE10-XYZ98765"
}
```

`earnedDiscountCode` is present when this order was the Nth order and a new code was generated.

**Error responses**

| Status | Reason |
|---|---|
| `400` | Cart is empty, invalid quantity, code already used, discount condition not met |
| `404` | Cart not found, product not found, discount code not found |

---

### Admin

#### `POST /admin/discount`
Manually generates a discount code. Only succeeds if total completed orders is a non-zero multiple of `NTH_ORDER`.

**Response** `201`
```json
{
  "discountCode": {
    "code": "SAVE10-ABCD1234",
    "percentage": 10,
    "isUsed": false,
    "createdAt": "..."
  }
}
```

#### `GET /admin/stats`
Returns aggregate store statistics.

**Response** `200`
```json
{
  "stats": {
    "totalOrders": 10,
    "totalItemsPurchased": 23,
    "totalRevenue": 1849.70,
    "totalDiscountGiven": 41.99,
    "discountCodes": {
      "total": 2,
      "used": 1,
      "unused": 1,
      "list": [
        { "code": "SAVE10-ABCD1234", "percentage": 10, "isUsed": true },
        { "code": "SAVE10-XYZ98765", "percentage": 10, "isUsed": false }
      ]
    }
  }
}
```

---

## Project Structure

```
src/
  store/
    index.ts          # In-memory singleton store + resetStore() for tests
    types.ts          # TypeScript interfaces
  services/
    cart.service.ts   # Cart CRUD — add, get, clear
    discount.service.ts # Code generation, validation, mark-used
    order.service.ts  # Checkout flow, stats aggregation
  routes/
    cart.routes.ts
    checkout.routes.ts
    admin.routes.ts
  middleware/
    error.middleware.ts  # Maps domain errors to HTTP status codes
  app.ts              # Express app factory
  server.ts           # HTTP server entry point
tests/
  cart.service.test.ts
  discount.service.test.ts
  order.service.test.ts
public/
  index.html          # Frontend
  style.css
  app.js
DECISIONS.md          # 9 documented design decisions
```

---

## Discount System — How It Works

1. The store is configured with `NTH_ORDER` (default: 5) and `DISCOUNT_PERCENTAGE` (default: 10).
2. When a customer's checkout results in the Nth completed order (1st, 2nd... 5th, 10th, 15th…), a discount code is automatically generated and returned in the checkout response.
3. The customer saves that code and applies it at their next checkout via the `discountCode` field.
4. Each code is **single-use** — once applied to an order it cannot be reused.
5. Admins can also manually trigger code generation via `POST /admin/discount` if the condition is currently satisfied.
