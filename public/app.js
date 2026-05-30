const API = '';  // same-origin — Express serves this file and the API

// ── State ──────────────────────────────────────────────────────────────────
let cartId = null;
let cartItems = [];  // local mirror to avoid re-fetching on every render

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  loadStats();
  bindButtons();
});

// ── Bind static button listeners ───────────────────────────────────────────
function bindButtons() {
  document.getElementById('cart-toggle-btn').addEventListener('click', showCart);
  document.getElementById('back-btn').addEventListener('click', showProducts);
  document.getElementById('checkout-btn').addEventListener('click', handleCheckout);
  document.getElementById('new-order-btn').addEventListener('click', resetToProducts);
  document.getElementById('gen-code-btn').addEventListener('click', handleGenerateCode);
}

// ── Section visibility ─────────────────────────────────────────────────────
function showSection(id) {
  ['products-section', 'cart-section', 'confirmation-section'].forEach(s => {
    document.getElementById(s).classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
}

function showProducts() { showSection('products-section'); }
function showCart() {
  renderCartItems();
  showSection('cart-section');
}

// ── Products ───────────────────────────────────────────────────────────────
async function loadProducts() {
  try {
    const res = await fetch(`${API}/products`);
    const { products } = await res.json();
    renderProducts(products);
  } catch {
    toast('Failed to load products');
  }
}

function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = products.map(p => `
    <div class="product-card">
      <span class="product-name">${p.name}</span>
      <span class="product-price">$${p.price.toFixed(2)}</span>
      <button onclick="addToCart('${p.id}')">Add to Cart</button>
    </div>
  `).join('');
}

// ── Cart ───────────────────────────────────────────────────────────────────
async function ensureCart() {
  if (cartId) return;
  const res = await fetch(`${API}/cart`, { method: 'POST' });
  const data = await res.json();
  cartId = data.cartId;
}

async function addToCart(productId) {
  try {
    await ensureCart();
    const res = await fetch(`${API}/cart/${cartId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity: 1 }),
    });
    if (!res.ok) { const d = await res.json(); toast(d.error); return; }
    const { cart } = await res.json();
    cartItems = cart.items;
    updateCartBadge();
    toast('Added to cart');
  } catch {
    toast('Failed to add item');
  }
}

function updateCartBadge() {
  const total = cartItems.reduce((s, i) => s + i.quantity, 0);
  document.getElementById('cart-count').textContent = total;
}

function renderCartItems() {
  const container = document.getElementById('cart-items');
  if (cartItems.length === 0) {
    container.innerHTML = '<p class="empty-cart">Your cart is empty.</p>';
    document.getElementById('cart-subtotal').textContent = '$0.00';
    return;
  }
  container.innerHTML = cartItems.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <span class="cart-item-name">${item.productId}</span>
        <span class="cart-item-meta">Qty: ${item.quantity} &times; $${item.unitPrice.toFixed(2)}</span>
      </div>
      <span class="cart-item-price">$${(item.quantity * item.unitPrice).toFixed(2)}</span>
    </div>
  `).join('');
  const subtotal = cartItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  document.getElementById('cart-subtotal').textContent = `$${subtotal.toFixed(2)}`;
}

// ── Checkout ───────────────────────────────────────────────────────────────
async function handleCheckout() {
  if (!cartId || cartItems.length === 0) { toast('Your cart is empty'); return; }
  const discountCode = document.getElementById('discount-input').value.trim() || undefined;
  try {
    const res = await fetch(`${API}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cartId, discountCode }),
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error); return; }
    renderConfirmation(data);
    cartId = null;
    cartItems = [];
    updateCartBadge();
    document.getElementById('discount-input').value = '';
    showSection('confirmation-section');
    loadStats();
  } catch {
    toast('Checkout failed');
  }
}

function renderConfirmation({ order, earnedDiscountCode }) {
  const summary = document.getElementById('order-summary');
  const rows = [
    ['Order ID', order.id.slice(0, 8) + '…'],
    ['Items', order.items.reduce((s, i) => s + i.quantity, 0)],
    ['Subtotal', `$${order.subtotal.toFixed(2)}`],
  ];
  if (order.discountCode) {
    rows.push(['Discount (' + order.discountCode + ')', `-$${order.discountAmount.toFixed(2)}`]);
  }
  rows.push(['Total', `$${order.total.toFixed(2)}`]);

  summary.innerHTML = rows.map(([label, val]) => `
    <div class="order-row">
      <span class="label">${label}</span>
      <span>${val}</span>
    </div>
  `).join('');

  if (earnedDiscountCode) {
    summary.innerHTML += `
      <div class="earned-code">
        You earned a discount code for being our ${document.getElementById('stats-content').dataset.orders || 'nth'} customer!
        <strong>${earnedDiscountCode}</strong>
        Save this code — use it on your next order.
      </div>
    `;
  }
}

// ── Admin Stats ────────────────────────────────────────────────────────────
async function loadStats() {
  const container = document.getElementById('stats-content');
  try {
    const res = await fetch(`${API}/admin/stats`);
    const { stats } = await res.json();
    container.dataset.orders = stats.totalOrders;
    renderStats(stats, container);
  } catch {
    container.innerHTML = '<p class="muted">Could not load stats.</p>';
  }
}

function renderStats(stats, container) {
  const codes = stats.discountCodes;
  container.innerHTML = `
    <div class="stats-card">
      <div class="stat-row"><span class="key">Total Orders</span><span class="val">${stats.totalOrders}</span></div>
      <div class="stat-row"><span class="key">Items Purchased</span><span class="val">${stats.totalItemsPurchased}</span></div>
      <div class="stat-row"><span class="key">Revenue</span><span class="val">$${stats.totalRevenue.toFixed(2)}</span></div>
      <div class="stat-row"><span class="key">Total Discounts Given</span><span class="val">$${stats.totalDiscountGiven.toFixed(2)}</span></div>
      <div class="stat-row"><span class="key">Codes (Total / Used / Unused)</span><span class="val">${codes.total} / ${codes.used} / ${codes.unused}</span></div>
    </div>
  `;
}

// ── Admin: Generate Discount Code ─────────────────────────────────────────
async function handleGenerateCode() {
  const resultEl = document.getElementById('gen-code-result');
  try {
    const res = await fetch(`${API}/admin/discount`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      resultEl.className = 'gen-code-error';
      resultEl.textContent = data.error;
    } else {
      resultEl.className = 'gen-code-success';
      resultEl.innerHTML = `Code generated: <strong>${data.discountCode.code}</strong> (${data.discountCode.percentage}% off)`;
      loadStats();
    }
  } catch {
    resultEl.className = 'gen-code-error';
    resultEl.textContent = 'Request failed';
  }
}

// ── Reset ──────────────────────────────────────────────────────────────────
function resetToProducts() {
  showProducts();
}

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
}
