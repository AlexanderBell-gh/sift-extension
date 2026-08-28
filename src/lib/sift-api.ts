import type { ExtractedProduct } from '../types';
import { LOYALTY_LABELS } from './loyalty';

const API_BASE_URL = 'https://siftapi.blackmesa.workers.dev';

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

async function apiRequest(url: string, options: RequestInit): Promise<{ ok: boolean; status: number; body: any }> {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    return chrome.runtime.sendMessage({
      action: 'apiRequest',
      url,
      options: {
        method: options.method,
        headers: options.headers,
        body: options.body,
      },
    });
  }
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

export async function addToWatchlist(
  token: string,
  product: ExtractedProduct
): Promise<{ success: boolean; error?: string; blocked?: boolean }> {
  const id = hashString(`${product.store}_${product.name}`);

  const body = {
    result: {
      id,
      name: product.name,
      store: product.store,
      store_logo: product.store_logo,
      image_url: product.image_url || '',
      unit: product.unit,
      prices: {
        normal: product.price,
        loyalty: product.loyalty_price,
        unit_price: null,
        currency: product.currency,
      },
      loyalty_type: LOYALTY_LABELS[product.store] || null,
      offer_deal: product.offer_deal || null,
      offer_expires_at: product.offer_expires_at || null,
      category: product.category || null,
      product_url: product.product_url,
      is_on_offer: !!product.was_price || !!product.offer_expires_at || !!product.loyalty_price || !!product.offer_deal,
    },
  };

  const { ok, body: resp } = await apiRequest(`${API_BASE_URL}/api/watchlist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!ok) {
    if (resp.reason === 'watchlist_limit') {
      return { success: false, blocked: true, error: 'Trial accounts are limited to 5 watchlist items. Remove some items on siftsearch.pages.dev to add more.' };
    }
    return { success: false, error: resp.error || 'Failed to add to watchlist' };
  }

  return { success: true };
}

export async function login(
  username: string,
  password: string
): Promise<{ token: string; error?: string }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Login failed' }));
    return { token: '', error: error.error || 'Login failed' };
  }

  const data = await response.json();
  return { token: data.token };
}
