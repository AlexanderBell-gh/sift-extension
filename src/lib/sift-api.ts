import type { ExtractedProduct } from '../types';

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

export async function addToWatchlist(
  token: string,
  product: ExtractedProduct
): Promise<{ success: boolean; error?: string }> {
  const id = hashString(`${product.store}_${product.name}`);

  const loyaltyTypeMap: Record<string, string> = {
    'Tesco': 'Clubcard',
    "Sainsbury's": 'Nectar',
    'Morrisons': 'More Card',
    'Co-op': 'Member',
    'Waitrose': 'My Waitrose',
  };

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
      loyalty_type: loyaltyTypeMap[product.store] || null,
      offer_expires_at: product.offer_expires_at || null,
      category: null,
      product_url: product.product_url,
      is_on_offer: !!product.offer_badge || !!product.was_price || !!product.offer_expires_at,
    },
  };

  const response = await fetch(`${API_BASE_URL}/api/watchlist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    return { success: false, error: error.error || 'Failed to add to watchlist' };
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
