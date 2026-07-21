import type { ExtractedProduct } from '../../src/types';
import { addToWatchlist, login } from '../../src/lib/sift-api';

const SIFT_LOGO = `<svg class="header-logo" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g transform="rotate(-10 16 16)">
    <rect x="6" y="2" width="20" height="28" rx="4" fill="#FF5701"/>
    <circle cx="16" cy="9" r="3" fill="white"/>
  </g>
</svg>`;

const app = document.getElementById('app')!;

let token = '';

async function init() {
  const stored = await chrome.storage.local.get('sift_token');
  token = stored.sift_token || '';

  if (!token) {
    renderLogin();
    return;
  }

  renderLoading();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    renderError('No active tab');
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extract' });
    if (response?.product) {
      renderProduct(response.product);
    } else {
      renderEmpty();
    }
  } catch {
    renderError('Cannot extract from this page');
  }
}

function renderLogin() {
  app.innerHTML = `
    <div class="header">
      ${SIFT_LOGO}
      <h1>Sift</h1>
    </div>
    <div class="login-form">
      <p class="subtitle">Sign in to add products to your watchlist.</p>
      <label for="username">Username</label>
      <input id="username" type="text" placeholder="Username" />
      <label for="password">Password</label>
      <input id="password" type="password" placeholder="Password" />
      <div id="login-error" class="error-msg"></div>
      <button class="btn btn-primary" id="login-btn">Sign In</button>
    </div>
  `;

  document.getElementById('login-btn')!.addEventListener('click', async () => {
    const username = (document.getElementById('username') as HTMLInputElement).value;
    const password = (document.getElementById('password') as HTMLInputElement).value;
    const errorEl = document.getElementById('login-error')!;
    const btn = document.getElementById('login-btn') as HTMLButtonElement;

    btn.disabled = true;
    btn.textContent = 'Signing in...';
    errorEl.textContent = '';

    const result = await login(username, password);
    if (result.error) {
      errorEl.textContent = result.error;
      btn.disabled = false;
      btn.textContent = 'Sign In';
    } else {
      token = result.token;
      await chrome.storage.local.set({ sift_token: token });
      init();
    }
  });
}

function renderLoading() {
  app.innerHTML = `
    <div class="header">
      ${SIFT_LOGO}
      <h1>Sift</h1>
    </div>
    <div class="loading">Extracting product data...</div>
  `;
}

function renderError(message: string) {
  app.innerHTML = `
    <div class="header">
      ${SIFT_LOGO}
      <h1>Sift</h1>
    </div>
    <div class="error">${message}</div>
  `;
}

function renderEmpty() {
  app.innerHTML = `
    <div class="header">
      ${SIFT_LOGO}
      <h1>Sift</h1>
    </div>
    <div class="empty">No product found on this page.</div>
  `;
}

function renderProduct(product: ExtractedProduct) {
  const imgHtml = product.image_url
    ? `<img class="product-img" src="${product.image_url}" alt="" />`
    : `<div class="product-img" style="display:flex;align-items:center;justify-content:center;font-size:24px">🛒</div>`;

  const priceHtml = product.price != null
    ? `<span class="price-current">£${product.price.toFixed(2)}</span>`
    : '';

  const wasHtml = product.was_price != null
    ? `<span class="price-was">£${product.was_price.toFixed(2)}</span>`
    : '';

  const loyaltyLabelMap: Record<string, string> = {
    'Tesco': 'Clubcard',
    "Sainsbury's": 'Nectar',
    'Morrisons': 'More Card',
    'Co-op': 'Member',
    'Waitrose': 'My Waitrose',
  };
  const loyaltyLabel = loyaltyLabelMap[product.store] || 'Loyalty';
  const loyaltyHtml = product.loyalty_price != null
    ? `<span class="price-loyalty">${loyaltyLabel} £${product.loyalty_price.toFixed(2)}</span>`
    : '';

  const badgeHtml = product.offer_badge
    ? `<div class="offer-badge">${product.offer_badge}</div>`
    : '';

  app.innerHTML = `
    <div class="header">
      ${SIFT_LOGO}
      <h1>Sift</h1>
    </div>
    <div class="product">
      <div class="product-top">
        ${imgHtml}
        <div class="product-info">
          <div class="product-store">${product.store}</div>
          <div class="product-name">${product.name || 'Unknown product'}</div>
          <div class="prices">
            ${priceHtml}
            ${wasHtml}
            ${loyaltyHtml}
          </div>
          ${badgeHtml}
        </div>
      </div>
    </div>
    <div class="actions">
      <button class="btn btn-primary" id="add-btn">Add to Watchlist</button>
      <button class="btn btn-secondary" id="signout-btn">Sign Out</button>
    </div>
  `;

  document.getElementById('add-btn')!.addEventListener('click', async () => {
    const btn = document.getElementById('add-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Adding...';

    const result = await addToWatchlist(token, product);
    if (result.success) {
      app.innerHTML = `
        <div class="header">
          ${SIFT_LOGO}
          <h1>Sift</h1>
        </div>
        <div class="success">Added to watchlist!</div>
      `;
    } else {
      btn.disabled = false;
      btn.textContent = 'Add to Watchlist';
      alert(result.error || 'Failed to add');
    }
  });

  document.getElementById('signout-btn')!.addEventListener('click', async () => {
    await chrome.storage.local.remove('sift_token');
    token = '';
    renderLogin();
  });
}

init();
