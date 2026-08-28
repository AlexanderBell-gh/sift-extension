import type { ExtractedProduct } from '../../src/types';
import { addToWatchlist } from '../../src/lib/sift-api';
import { LOYALTY_LABELS } from '../../src/lib/loyalty';

const STORE_COLORS: Record<string, string> = {
  "Sainsbury's": '#8223fa',
  'Tesco': '#00539f',
  'ASDA': '#c21e4d',
  'Morrisons': '#005f27',
  'M&S': '#242230',
};

const SIFT_LOGO = `<svg class="header-logo" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <mask id="logo-hole">
      <rect width="32" height="32" fill="white"/>
      <circle cx="16" cy="9" r="3" fill="black"/>
    </mask>
  </defs>
  <g transform="rotate(-10 16 16)">
    <rect x="6" y="2" width="20" height="28" rx="4" fill="#FF5701" mask="url(#logo-hole)"/>
  </g>
</svg>`;

const app = document.getElementById('app')!;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let token = '';

async function init() {
  const stored = await chrome.storage.local.get('sift_token');
  token = stored.sift_token || '';

  if (!token) {
    const tabs = await chrome.tabs.query({ url: ['https://siftsearch.pages.dev/*', 'http://localhost:5173/*'] });
    if (tabs.length > 0 && tabs[0].id) {
      try {
        const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getToken' });
        if (response?.token) {
          token = response.token;
          await chrome.storage.local.set({ sift_token: token });
        }
      } catch {
        // Content script not ready or tab unavailable
      }
    }

    if (!token) {
      renderLogin();
      return;
    }
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
    <div class="auth-prompt">
      <p class="auth-prompt-title">Sign in to Sift to get started.</p>
      <p class="auth-prompt-text">Open siftsearch.pages.dev, sign in to your account, and your session will sync to the extension automatically.</p>
      <button class="btn btn-primary" id="open-sift-btn">Open Sift</button>
    </div>
  `;

  document.getElementById('open-sift-btn')!.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://siftsearch.pages.dev' });
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
    <div class="error">${escapeHtml(message)}</div>
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
    ? `<img class="product-img" src="${escapeHtml(product.image_url)}" alt="" />`
    : `<div class="product-img" style="display:flex;align-items:center;justify-content:center;font-size:24px">🛒</div>`;

  const priceHtml = product.price != null
    ? `<span class="price-current">£${product.price.toFixed(2)}</span>`
    : '';

  const wasHtml = product.was_price != null
    ? `<span class="price-was">£${product.was_price.toFixed(2)}</span>`
    : '';

  const loyaltyLabel = LOYALTY_LABELS[product.store] || 'Loyalty';
  const storeColor = STORE_COLORS[product.store];

  const hasMultiBuy = !!product.offer_deal;
  const loyaltyHtml = !hasMultiBuy && product.loyalty_price != null
    ? `<span class="price-loyalty"${storeColor ? ` style="color:${storeColor}"` : ''}>${loyaltyLabel} £${product.loyalty_price.toFixed(2)}</span>`
    : '';

  const dealHtml = product.offer_deal
    ? `<div class="deal-badge"${storeColor ? ` style="background:${storeColor}"` : ''} title="${escapeHtml(product.offer_deal)}">${escapeHtml(product.offer_deal)}</div>`
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
          <div class="product-store">${escapeHtml(product.store)}</div>
          <div class="product-name">${escapeHtml(product.name || 'Unknown product')}</div>
          <div class="prices">
            ${priceHtml}
            ${wasHtml}
            ${loyaltyHtml}
          </div>
          ${dealHtml}
        </div>
      </div>
    </div>
    <div class="actions">
      <button class="btn btn-primary" id="add-btn">Add to Watchlist</button>
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
    } else if (result.blocked) {
      app.innerHTML = `
        <div class="header">
          ${SIFT_LOGO}
          <h1>Sift</h1>
        </div>
        <div class="blocked">
          <div class="blocked-icon">!</div>
          <div class="blocked-title">Watchlist full</div>
          <p class="blocked-text">Trial accounts are limited to 5 items.</p>
          <p class="blocked-text">Remove old items on your <a href="https://siftsearch.pages.dev/watchlist" target="_blank">Watchlist</a> to add more.</p>
          <button class="btn btn-secondary" id="back-btn">Back</button>
        </div>
      `;
      document.getElementById('back-btn')!.addEventListener('click', () => renderProduct(product));
    } else {
      btn.disabled = false;
      btn.textContent = 'Add to Watchlist';
    }
  });
}

init();
