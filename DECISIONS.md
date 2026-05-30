# Design Decisions

---

## Decision 1: In-Memory Store as a Module Singleton

**Context:** The assignment requires storing state (products, carts, orders, discount codes) without a database.

**Options Considered:**
- Option A: Module-level singleton object exported from `store/index.ts`
- Option B: Class-based `Store` with dependency injection
- Option C: Embedded SQLite for persistence across restarts

**Choice:** Option A — module singleton.

**Why:** A module singleton is the simplest correct solution for an in-memory requirement. It requires zero boilerplate, is naturally shared across all service imports, and makes the code easy to read and trace. Class-based DI adds indirection without benefit when there is only one store instance. SQLite adds a file dependency that contradicts "in-memory is fine." A `resetStore()` helper is exported to give tests clean state between runs, solving the only real drawback of the singleton approach.

---

## Decision 2: Price Snapshotted at Cart-Add Time

**Context:** Products have a price. A customer may add an item, browse for a while, and check out later. Should checkout use the current catalog price or the price at the time the item was added?

**Options Considered:**
- Option A: Snapshot `unitPrice` into the `CartItem` at add time
- Option B: Always look up the current product price at checkout

**Choice:** Option A — snapshot at add time.

**Why:** This matches standard e-commerce behavior (Amazon, Shopify, and virtually all major platforms do this). Users expect the price they saw when they clicked "Add to Cart" to be the price they pay. It also makes `CartItem` self-contained — checkout does not need to re-query the product catalog. The trade-off is that a cart can hold a stale price if the catalog changes, but for this scope that is the correct behavior, not a bug.

---

## Decision 3: Discount Codes are Single-Use

**Context:** The spec says "a coupon code for x% discount." It is ambiguous whether a code can be reused.

**Options Considered:**
- Option A: Single-use — once applied to an order, `isUsed` is set to `true` permanently
- Option B: Multi-use with a configurable use limit
- Option C: Time-based expiry instead of use count

**Choice:** Option A — single-use.

**Why:** "A coupon code" (singular) implies one-time use. Single-use codes are the most common pattern for reward-based coupons (loyalty, referral, nth-order bonuses) because they prevent abuse. The implementation is simpler: validate `isUsed === false`, then flip it. Multi-use would require a counter and raises questions about concurrency. Expiry-based codes would require wall-clock time in tests, adding complexity with no stated requirement.

---

## Decision 4: New Discount Code Auto-Generated at Checkout (Not Just via Admin)

**Context:** The spec says "every nth order gets a coupon code." It also says there is an admin API to "generate a discount code if the condition is satisfied." This could be read two ways: (a) codes are only ever created by the admin manually, or (b) they are also auto-created at checkout when the threshold is hit.

**Options Considered:**
- Option A: Auto-generate at checkout when `orderCount % N === 0`, return code in response
- Option B: Admin-only generation — checkout never creates codes, admin must trigger manually after each nth order

**Choice:** Option A — auto-generate at checkout, admin API as a manual fallback.

**Why:** "Every nth order *gets* a coupon code" implies the customer receives the code as part of their checkout experience, not after waiting for an admin to log in and press a button. Returning the earned code directly in the checkout response gives the user immediate feedback. The admin API is retained as a manual trigger for cases where the admin wants to generate a code outside the normal flow (e.g., customer service). Both paths share a private `buildCode()` helper — the admin path enforces the condition guard before calling it, while `issueRewardCode()` is called by OrderService which already verified the threshold.

---

## Decision 5: CartId is Client-Supplied (No Separate Cart-Creation Step Required)

**Context:** Carts need to be addressable. The question is whether the client must first call `POST /cart` to get an ID, or whether the first item-add implicitly creates the cart.

**Options Considered:**
- Option A: `POST /cart` creates a cart and returns a UUID; client uses that UUID for all subsequent calls
- Option B: Client supplies any UUID as `cartId`; first item-add creates the cart implicitly

**Choice:** Option A — explicit `POST /cart` endpoint, returning a server-generated UUID. (The frontend uses this flow. The service layer also handles implicit creation as a convenience for direct API callers.)

**Why:** An explicit creation step makes the API contract clearer and ensures the `cartId` is always a valid UUID from the server. It also provides a logical place to add user association or session logic in the future. The service layer's implicit creation is kept as a safety net but the canonical flow goes through `POST /cart`.

---

## Decision 6: Services Contain All Business Logic; Routes Are Pure HTTP Adapters

**Context:** The code must be unit-testable. The question is where to draw the boundary between business logic and HTTP handling.

**Options Considered:**
- Option A: Business logic in service modules; routes only parse request/response and call services
- Option B: Business logic directly in route handlers

**Choice:** Option A — strict separation.

**Why:** Unit tests import service functions directly with no HTTP layer involved. This makes tests fast, readable, and isolated from Express internals. If the API framework were swapped (e.g., Fastify, AWS Lambda handler), the business logic would require zero changes. Route handlers are intentionally thin: validate required fields are present, call the service, and map domain errors to HTTP status codes via a central error middleware.

---

## Decision 7: Discount Percentage and Nth-Order Threshold are Environment-Configurable

**Context:** The spec says "every nth order" and "x% discount" without specifying values. These could be hardcoded constants or runtime configuration.

**Options Considered:**
- Option A: Hardcoded constants (`const N = 5`, `const X = 10`)
- Option B: Read from environment variables with sensible defaults (`NTH_ORDER=5`, `DISCOUNT_PERCENTAGE=10`)

**Choice:** Option B — environment variables with defaults.

**Why:** Environment variables allow different values in different environments (development, testing, production) without code changes. Tests can verify behavior at any threshold by manipulating `store.config` directly rather than changing source code. The defaults (`N=5`, `X=10`) are sensible out-of-the-box values so the app works with zero configuration. Hardcoding would make testing different N values awkward and would require a code deploy to change business parameters.

---

## Decision 8: One Discount Code Per Order Milestone (Deduplication via `lastCodeGeneratedAtOrder`)

**Context:** The checkout flow auto-generates a discount code on every Nth order. The admin API can also trigger generation manually when the condition is met. Without a guard, both paths could fire for the same milestone, producing multiple codes for a single reward event — which is unintended abuse.

**Options Considered:**
- Option A: Allow multiple codes per milestone — simple, no tracking needed
- Option B: Track the order count at which the last code was issued; block generation if the current count matches

**Choice:** Option B — track `lastCodeGeneratedAtOrder` in store config.

**Why:** One milestone should produce exactly one reward code. Allowing duplicates lets a customer (or admin) generate unlimited codes at the same threshold, defeating the purpose of the reward system. The fix is lightweight: a single integer field on the config, set whenever a code is issued. Both the admin path and the auto-checkout path share the same `buildCode()` helper which stamps this field, so the guard is impossible to bypass regardless of which path triggered the generation. `resetStore()` resets this field to ensure test isolation.

---

## Decision 9: Admin Endpoints Have No Authentication

**Context:** The two admin endpoints (`POST /admin/discount`, `GET /admin/stats`) expose privileged operations — generating discount codes and viewing revenue data. Should they require authentication?

**Options Considered:**
- Option A: No auth — document the gap, note the production approach
- Option B: Hardcoded API key checked via a request header
- Option C: JWT middleware with a separate login flow

**Choice:** Option A — no auth, explicitly documented.

**Why:** The assignment scope is the discount and cart system, not an auth system. Adding JWT requires a user store, token signing, and a login endpoint — all outside the problem statement. A hardcoded API key would give false confidence without real security. The correct production approach is an auth middleware layer (JWT or API key from a secrets manager) applied to an `adminRouter` — the route structure already supports this cleanly since admin routes are registered separately. Leaving it undone and documenting it is more honest than adding security theatre.
