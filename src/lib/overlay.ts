import type { ExtractedProduct } from '../types';
import { extractProduct } from './extract';
import { addToWatchlist } from './sift-api';
import { LOYALTY_LABELS } from './loyalty';
import overlayCss from './overlay.css?inline';

const SIFT_LOGO = `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <mask id="sift-logo-hole">
      <rect width="32" height="32" fill="white"/>
      <circle cx="16" cy="9" r="3" fill="black"/>
    </mask>
  </defs>
  <g transform="rotate(-10 16 16)">
    <rect x="6" y="2" width="20" height="28" rx="4" fill="#FFFFFF" mask="url(#sift-logo-hole)"/>
  </g>
</svg>`;

const CLOSE_ICON = `<svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const STORE_COLORS: Record<string, string> = {
  "Sainsbury's": '#8223fa',
  'Tesco': '#00539f',
  'ASDA': '#c21e4d',
  'Morrisons': '#005f27',
  'M&S': '#242230',
};

let floatBtn: HTMLDivElement | null = null;
let overlayRoot: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let currentUrl = location.href;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const day = d.getUTCDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const FLOAT_BTN_CSS = `
.sift-float-btn {
  position: fixed;
  bottom: 24px;
  left: 24px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #FF5701;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: background 0.15s ease, transform 0.15s ease;
  z-index: 999999;
  padding: 0;
}
.sift-float-btn:hover {
  background: #E64D00;
  transform: scale(1.05);
}
.sift-float-btn:active {
  transform: scale(0.95);
}
.sift-float-btn svg {
  width: 24px;
  height: 24px;
}
.sift-float-btn-hidden {
  display: none !important;
}
.sift-float-btn-pressed {
  background: #E64D00 !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25) !important;
  transform: scale(0.92) !important;
}
.sift-overlay-root {
  position: fixed;
  bottom: 84px;
  left: 24px;
  z-index: 999999;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 14px;
  color: #111827;
  -webkit-font-smoothing: antialiased;
  line-height: 1.4;
}`;

function injectPageStyles() {
  if (document.querySelector('style[data-sift-page-styles]')) return;
  const style = document.createElement('style');
  style.setAttribute('data-sift-page-styles', '1');
  style.textContent = FLOAT_BTN_CSS;
  document.head.appendChild(style);

  if (document.querySelector('link[data-sift-overlay-font]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
  link.setAttribute('data-sift-overlay-font', '1');
  document.head.appendChild(link);
}

function createFloatBtn() {
  if (floatBtn) return floatBtn;
  floatBtn = document.createElement('div');
  floatBtn.className = 'sift-float-btn';
  floatBtn.innerHTML = SIFT_LOGO;
  floatBtn.title = 'Sift — View product';
  document.body.appendChild(floatBtn);
  floatBtn.addEventListener('click', onFloatClick);
  return floatBtn;
}

function removeFloatBtn() {
  if (floatBtn) {
    floatBtn.removeEventListener('click', onFloatClick);
    floatBtn.remove();
    floatBtn = null;
  }
}

function showFloatBtn() {
  floatBtn?.classList.remove('sift-float-btn-hidden');
}

function hideFloatBtn() {
  floatBtn?.classList.add('sift-float-btn-hidden');
}

function destroyOverlay() {
  if (overlayRoot) {
    overlayRoot.remove();
    overlayRoot = null;
    shadowRoot = null;
  }
  floatBtn?.classList.remove('sift-float-btn-pressed');
}

async function renderOverlay(product: ExtractedProduct) {
  destroyOverlay();

  floatBtn?.classList.add('sift-float-btn-pressed');

  overlayRoot = document.createElement('div');
  overlayRoot.className = 'sift-overlay-root';
  document.body.appendChild(overlayRoot);

  shadowRoot = overlayRoot.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = overlayCss;
  shadowRoot.appendChild(style);

  const storeColor = STORE_COLORS[product.store];
  const loyaltyLabel = LOYALTY_LABELS[product.store] || 'Loyalty';
  const hasMultiBuy = !!product.offer_deal;

  const priceHtml = product.price != null
    ? `<span class="sift-price-current">£${product.price.toFixed(2)}</span>`
    : '';

  const wasHtml = product.was_price != null
    ? `<span class="sift-price-was">£${product.was_price.toFixed(2)}</span>`
    : '';

  const loyaltyHtml = !hasMultiBuy && product.loyalty_price != null
    ? `<span class="sift-price-loyalty"${storeColor ? ` style="color:${storeColor}"` : ''}>${loyaltyLabel} £${product.loyalty_price.toFixed(2)}</span>`
    : '';

  const dealHtml = product.offer_deal
    ? `<div class="sift-deal-badge"${storeColor ? ` style="background:${storeColor}"` : ''} title="${escapeHtml(product.offer_deal)}">${escapeHtml(product.offer_deal)}</div>`
    : '';

  const expiryHtml = product.offer_expires_at
    ? `<div class="sift-expiry">Offer Expires ${escapeHtml(formatDate(product.offer_expires_at))}</div>`
    : '';

  const imgHtml = product.image_url
    ? `<img class="sift-product-img" src="${escapeHtml(product.image_url)}" alt="" />`
    : '';

  const overlay = document.createElement('div');
  overlay.className = 'sift-overlay';
  overlay.innerHTML = `
    <div class="sift-overlay-header">
      <span class="sift-store-label">${escapeHtml(product.store)}</span>
      <button class="sift-close-btn" aria-label="Close">${CLOSE_ICON}</button>
    </div>
    <div class="sift-overlay-body">
      <div class="sift-product-top">
        ${imgHtml}
        <div class="sift-product-info">
          <div class="sift-product-name">${escapeHtml(product.name || 'Unknown product')}</div>
          <div class="sift-prices">
            ${priceHtml}
            ${wasHtml}
            ${loyaltyHtml}
          </div>
          ${expiryHtml}
        </div>
      </div>
      ${dealHtml}
    </div>
    <div class="sift-overlay-actions" id="sift-actions"></div>
  `;
  shadowRoot.appendChild(overlay);

  const actionsEl = shadowRoot.getElementById('sift-actions')!;

  const stored = await chrome.storage.local.get('sift_token');
  const token = stored.sift_token || '';
  if (!token) {
    actionsEl.innerHTML = `
      <div class="sift-auth-msg">
        <p>Sign in via the extension popup to add items to your watchlist.</p>
        <p><a href="https://siftsearch.pages.dev" target="_blank">Open Sift</a></p>
      </div>
    `;
    return;
  }

  actionsEl.innerHTML = `<button class="sift-add-btn" id="sift-add-btn">Add to Watchlist</button>`;
  const addBtn = actionsEl.querySelector('#sift-add-btn') as HTMLButtonElement;
  addBtn.addEventListener('click', () => handleAddToWatchlist(token, product, actionsEl));

  const closeBtn = overlay.querySelector('.sift-close-btn')!;
  closeBtn.addEventListener('click', destroyOverlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) destroyOverlay();
  });

  document.addEventListener('keydown', onEscapeKey);
}

function onEscapeKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    destroyOverlay();
    document.removeEventListener('keydown', onEscapeKey);
  }
}

async function handleAddToWatchlist(token: string, product: ExtractedProduct, container: HTMLElement) {
  const addBtn = container.querySelector('#sift-add-btn') as HTMLButtonElement | null;
  if (addBtn) {
    addBtn.disabled = true;
    addBtn.textContent = 'Adding...';
  }

  try {
    const result = await addToWatchlist(token, product);

    if (result.success) {
      container.innerHTML = `
        <div class="sift-checkmark">
          ${CHECK_ICON}
          <span>Added to watchlist</span>
        </div>
      `;
      setTimeout(() => {
        destroyOverlay();
        document.removeEventListener('keydown', onEscapeKey);
      }, 1500);
    } else if (result.blocked) {
      container.innerHTML = `
        <div class="sift-blocked-msg">
          <div class="sift-blocked-title">Watchlist full</div>
          <p class="sift-blocked-text">Trial accounts are limited to 5 items.</p>
          <p class="sift-blocked-text">Remove old items on your <a href="https://siftsearch.pages.dev/watchlist" target="_blank">Watchlist</a> to add more.</p>
        </div>
      `;
    } else {
      if (addBtn) {
        addBtn.disabled = false;
        addBtn.textContent = 'Add to Watchlist';
      }
    }
  } catch (e) {
    console.error('[Sift overlay] add to watchlist failed:', e);
    if (addBtn) {
      addBtn.disabled = false;
      addBtn.textContent = 'Add to Watchlist';
    }
  }
}

function onFloatClick() {
  const product = extractProduct();
  if (!product) {
    hideFloatBtn();
    return;
  }
  renderOverlay(product);
}

function checkStore() {
  const hostname = window.location.hostname;
  const isStore = hostname.includes('tesco.com')
    || hostname.includes('sainsburys.co.uk')
    || hostname.includes('asda.com')
    || hostname.includes('morrisons.com')
    || hostname.includes('marksandspencer.com')
    || hostname.includes('aldi.co.uk')
    || hostname.includes('lidl.co.uk')
    || hostname.includes('coop.co.uk')
    || hostname.includes('waitrose.com')
    || hostname.includes('iceland.co.uk')
    || hostname.includes('ocado.com');

  if (isStore) {
    createFloatBtn();
    showFloatBtn();
  } else {
    removeFloatBtn();
    destroyOverlay();
  }
}

function setupNavigationCleanup() {
  const observer = new MutationObserver(() => {
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        destroyOverlay();
        checkStore();
      }, 300);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('popstate', () => {
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      destroyOverlay();
      checkStore();
    }
  });
}

export function initOverlay() {
  injectPageStyles();
  checkStore();
  setupNavigationCleanup();
}
