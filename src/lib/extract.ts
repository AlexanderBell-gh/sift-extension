import type { ExtractedProduct } from '../types';

interface JsonLdOffer {
  '@type': string;
  price?: string;
  priceCurrency?: string;
  url?: string;
  priceValidUntil?: string;
}

interface JsonLdProduct {
  '@type': string;
  name?: string;
  image?: string | string[];
  sku?: string;
  gtin13?: string;
  brand?: { name?: string };
  category?: string;
  offers?: JsonLdOffer | JsonLdOffer[];
  description?: string;
}

function parsePrice(text: string | undefined | null): number | null {
  if (!text) return null;
  const match = text.replace(/,/g, '').match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : null;
}

function getProductRoot(): HTMLElement | Document {
  const sel = document.querySelector<HTMLElement>(
    'main, [role="main"], article, .product-detail, [data-auto="product-detail"], [data-testid="product-detail"]'
  );
  return sel || document;
}

function qs<K extends HTMLElement>(sel: string, root: ParentNode): K | null {
  return root.querySelector<K>(sel);
}

function qsa<K extends HTMLElement>(sel: string, root: ParentNode): NodeListOf<K> {
  return root.querySelectorAll<K>(sel);
}

function getText(selectors: string[], root: ParentNode = document): string | null {
  for (const sel of selectors) {
    const el = qs<HTMLElement>(sel, root);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  return null;
}

function getLoyaltyPriceByPattern(root: ParentNode = document): string | null {
  const patterns = [
    /(?:nectar|clubcard|member|loyalty|more\s*card|partner)\s*(?:price|saving)?[:\s]*£?\s*(\d+\.?\d*)/i,
    /£\s*(\d+\.?\d*)\s*(?:with|when you use|using)\s*(?:nectar|clubcard|member|loyalty)/i,
  ];
  const candidates = qsa<HTMLElement>(
    '[class*="price"], [class*="loyalty"], [class*="member"], [class*="nectar"], [class*="clubcard"], [data-testid*="price"], [data-testid*="loyalty"]',
    root
  );
  for (const el of candidates) {
    const text = el.textContent || '';
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
  }
  return null;
}

function extractOfferExpiry(): string | null {
  const dateShort = /\d{1,2}\s+\w+\s+\d{4}/;

  const sainsburysEl = document.querySelector<HTMLElement>('.expiry-date');
  if (sainsburysEl?.textContent) {
    const match = sainsburysEl.textContent.trim().match(dateShort);
    if (match) return match[0];
  }

  const tescoSel = '.ddsweb-value-bar__terms, [class*="value-bar__terms"], [class*="termsText"]';
  const tescoEls = document.querySelectorAll<HTMLElement>(tescoSel);
  for (const el of tescoEls) {
    const text = el.textContent?.trim() || '';
    const match = text.match(/until\s+(\d{2}\/\d{2}\/\d{4})/);
    if (match) return match[1];
  }

  const patterns = [
    /until\s+(\d{2}\/\d{2}\/\d{4})/,
    new RegExp('until[\\s:]\\s*(' + dateShort.source + ')', 'i'),
    new RegExp('expires?[\\s:]\\s*(' + dateShort.source + ')', 'i'),
    new RegExp('valid until[\\s:]\\s*(' + dateShort.source + ')', 'i'),
    new RegExp('ends?[\\s:]\\s*(' + dateShort.source + ')', 'i'),
  ];
  const candidates = document.querySelectorAll<HTMLElement>(
    '[class*="offer"], [class*="promotion"], [class*="expiry"], [class*="terms"], [data-testid*="offer"], [data-testid*="promotion"], p, span, div'
  );
  for (const el of candidates) {
    const text = el.textContent || '';
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
  }
  return null;
}

function getAttr(selectors: string[], attr: string, root: ParentNode = document): string | null {
  for (const sel of selectors) {
    const el = qs<HTMLElement>(sel, root);
    const val = el?.getAttribute(attr);
    if (val) return val;
  }
  return null;
}

// Category conversion
const CATEGORY_MAP: Record<string, string> = {
  'Low Fat & Fat Free Yogurt': 'Chilled',
  'Natural, organic & greek yogurt': 'Chilled',
  'Eggs': 'Food Cupboard',
  'Crackers': 'Food Cupboard',
  'Doughnuts and cookies': 'Food Cupboard',
  'Milk': 'Chilled',
  'Berries & Cherries': 'Chilled',
  'Ice cream tubs': 'Frozen',
};

function normalizeCategory(raw: string): string {
  const cleaned = raw.replace(/^Back to\s+/i, '');
  return CATEGORY_MAP[cleaned] || cleaned;
}

function extractCategory(root: ParentNode = document): string | null {
  const selectors = [
    '[data-auto="breadcrumb"] a',
    '[data-testid="breadcrumb"] a',
    'nav[aria-label="breadcrumb"] a',
    '.breadcrumbs a',
    '.breadcrumb a',
    'ol[class*="breadcrumb"] a',
  ];
  const links = qsa<HTMLElement>(selectors.join(','), root);
  const crumbs: string[] = [];
  for (const link of links) {
    const text = link.textContent?.trim();
    if (text) crumbs.push(text);
  }
  const raw = crumbs.length > 0 ? crumbs[crumbs.length - 1] : null;
  return raw ? normalizeCategory(raw) : null;
}

function extractFromJsonLd(): Partial<ExtractedProduct> | null {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '');
      if (data['@type'] === 'Product') {
        const product = data as JsonLdProduct;
        const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
        const image = Array.isArray(product.image) ? product.image[0] : product.image;
        return {
          name: product.name || null,
          price: parsePrice(offers?.price),
          image_url: image || null,
          product_url: offers?.url || window.location.href,
          offer_expires_at: offers?.priceValidUntil || null,
          category: product.category || null,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function extractFromDom(): Partial<ExtractedProduct> {
  const root = getProductRoot();

  const priceText = getText([
    '[data-auto="price-per-quantity-weight"]',
    '.price-main__integer',
    '.product-price',
    '.pt__cost__retail-price',
    '[data-testid="product-tile-price"]',
    '[data-testid="pd-retail-price"]',
    '.pd__cost__retail-price',
    '.online-components-product-tile-price__text',
  ], root);

  const wasPriceText = getText([
    '[data-auto="was-price"]',
    '.price--was',
    '.product-price--previous',
    '.pt__cost__retail-price--was',
    '[data-testid="was-price"]',
  ], root);

  const loyaltyPriceText = getText([
    '[data-auto="clubcard-price"]',
    '.price--clubcard',
    '.clubcard-price',
    '[data-testid="clubcard-price"]',
    '[data-testid="contextual-price-text"]',
    '.pd__cost--price',
    '.ddsweb-value-bar__content-text',
    '.nectar-offer',
    '[class*="nectar-price"]',
    '[data-testid*="nectar"]',
    '.product-pricing__nectar',
    '[class*="more-card"]',
    '[data-testid*="more-card"]',
    '[class*="member-price"]',
    '[data-testid*="member"]',
    '[class*="loyalty"]',
    '[data-testid*="loyalty"]',
    '[class*="partner-price"]',
    '[data-testid*="partner"]',
    '[class*="asda-price"]',
    '[data-testid*="reduced"]',
  ], root) || getLoyaltyPriceByPattern(root);

  const offerBadge = getText([
    '[data-auto="promotion-badge"]',
    '.promotions__badge',
    '.offer-text',
    '.promotion-banner',
    '[data-testid="promotion-badge"]',
  ], root);

  const imageUrl = getAttr([
    'img[data-auto="product-image"]',
    '.product-image img',
    'img[src*="digitalcontent.api.tesco.com"]',
    '[data-testid="product-tile-image"] img',
  ], 'src', root);

  const title = getText([
    'h1',
    '[data-auto="product-title"]',
    '[data-testid="product-tile-title"]',
  ], root);

  return {
    name: title,
    price: parsePrice(priceText),
    was_price: parsePrice(wasPriceText),
    loyalty_price: parsePrice(loyaltyPriceText),
    offer_badge: offerBadge,
    offer_expires_at: extractOfferExpiry(),
    image_url: imageUrl,
    product_url: window.location.href,
    category: extractCategory(root),
  };
}

function detectStore(): { id: string; name: string; logo: string } | null {
  const hostname = window.location.hostname;
  if (hostname.includes('tesco.com')) {
    return { id: 'tesco', name: 'Tesco', logo: '/Tesco_Logo.svg' };
  }
  if (hostname.includes('sainsburys.co.uk')) {
    return { id: 'sainsburys', name: "Sainsbury's", logo: "/Sainsbury's_Logo.svg" };
  }
  if (hostname.includes('asda.com')) {
    return { id: 'asda', name: 'ASDA', logo: '/ASDA_Logo.svg' };
  }
  if (hostname.includes('morrisons.com')) {
    return { id: 'morrisons', name: 'Morrisons', logo: '/Morrisons_Logo.svg' };
  }
  if (hostname.includes('marksandspencer.com')) {
    return { id: 'marksandspencer', name: 'M&S', logo: '/M&S_Logo.svg' };
  }
  if (hostname.includes('aldi.co.uk')) {
    return { id: 'aldi', name: 'Aldi', logo: '/Aldi_Logo.svg' };
  }
  if (hostname.includes('lidl.co.uk')) {
    return { id: 'lidl', name: 'Lidl', logo: '/Lidl_Logo.svg' };
  }
  if (hostname.includes('coop.co.uk')) {
    return { id: 'coop', name: 'Co-op', logo: '/Co-op_Logo.svg' };
  }
  if (hostname.includes('waitrose.com')) {
    return { id: 'waitrose', name: 'Waitrose', logo: '/Waitrose_Logo.svg' };
  }
  if (hostname.includes('iceland.co.uk')) {
    return { id: 'iceland', name: 'Iceland', logo: '/Iceland_Logo.svg' };
  }
  if (hostname.includes('ocado.com')) {
    return { id: 'ocado', name: 'Ocado', logo: '/Ocado_Logo.svg' };
  }
  return null;
}

export function extractProduct(): ExtractedProduct | null {
  const store = detectStore();
  if (!store) return null;

  const jsonLd = extractFromJsonLd();
  const dom = extractFromDom();

  return {
    name: dom.name || jsonLd?.name || null,
    price: dom.price ?? jsonLd?.price ?? null,
    loyalty_price: dom.loyalty_price ?? null,
    was_price: dom.was_price ?? null,
    offer_badge: dom.offer_badge ?? null,
    offer_expires_at: dom.offer_expires_at ?? jsonLd?.offer_expires_at ?? null,
    image_url: jsonLd?.image_url ?? dom.image_url ?? null,
    product_url: jsonLd?.product_url || dom.product_url || window.location.href,
    category: dom.category ?? jsonLd?.category ?? null,
    store: store.name,
    store_logo: store.logo,
    unit: null,
    currency: 'GBP',
  };
}
