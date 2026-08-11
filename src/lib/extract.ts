import type { ExtractedProduct } from '../types';
import { normalizeCategory } from './category-map';

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
  const cleaned = text.replace(/,/g, '');

  if (cleaned.includes('\u00A3')) {
    if (/\d\s*for\s*£?\s*\d/.test(cleaned)) return null;
    const poundMatch = cleaned.match(/£\s*(\d+\.?\d*)/);
    if (poundMatch) return parseFloat(poundMatch[1]);
  } else {
    const pence = cleaned.match(/(\d+)p\b/i);
    if (pence) return parseFloat(pence[1]) / 100;
    if (/%/.test(cleaned)) return null;
  }

  const match = cleaned.match(/(\d+\.?\d*)/);
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

function toISODate(raw: string): string {
  const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slash) return `${slash[3]}-${slash[2]}-${slash[1]}`;

  const months: Record<string, string> = {
    january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',
    july:'07',august:'08',september:'09',october:'10',november:'11',december:'12',
    jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
    jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
  };
  const text = raw.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
  if (text) {
    const m = months[text[2].toLowerCase()];
    if (m) return `${text[3]}-${m}-${String(text[1]).padStart(2, '0')}`;
  }

  return raw;
}

function extractOfferExpiry(): string | null {
  const dateShort = /\d{1,2}\s+\w+\s+\d{4}/;

  // ---- Sainsbury's ----
  if (isStore('sainsburys')) {
    const sainsburysEl = document.querySelector<HTMLElement>('.expiry-date');
    if (sainsburysEl?.textContent) {
      const match = sainsburysEl.textContent.trim().match(dateShort);
      if (match) return toISODate(match[0]);
    }

    const sainsburysAlert = document.querySelector<HTMLElement>(
      '[class*="alert__message"], [class*="alert-message"], .ds-c-alert'
    );
    if (sainsburysAlert?.textContent) {
      const match = sainsburysAlert.textContent.match(/(\d{1,2}\s+\w+\s+\d{4})/);
      if (match) return toISODate(match[1]);
    }
  }

  // ---- Tesco ----
  if (isStore('tesco')) {
    const tescoSel = '.ddsweb-value-bar__terms, [class*="value-bar__terms"], [class*="termsText"]';
    const tescoEls = document.querySelectorAll<HTMLElement>(tescoSel);
    for (const el of tescoEls) {
      const text = el.textContent?.trim() || '';
      const match = text.match(/until\s+(\d{2}\/\d{2}\/\d{4})/);
      if (match) return toISODate(match[1]);
    }
  }

  // ---- Morrisons ----
  if (isStore('morrisons')) {
    const morrisonsEls = document.querySelectorAll<HTMLElement>('[class*="--promotion"]');
    for (const el of morrisonsEls) {
      const text = el.textContent || '';
      if (!/offer/i.test(text)) continue;
      const match =
        text.match(/(?:order\s*by|until|before|valid until)\s+(\d{2}\/\d{2}\/\d{4})/i) ||
        text.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (match) return toISODate(match[1]);
    }
  }

  // ---- Generic fallback ----
  const patterns = [
    /until\s+(\d{2}\/\d{2}\/\d{4})/,
    new RegExp('until[\\s:]\\s*(?:[a-z]{3,9},\\s*)?(' + dateShort.source + ')', 'i'),
    new RegExp('expires?[\\s:]\\s*(?:[a-z]{3,9},\\s*)?(' + dateShort.source + ')', 'i'),
    new RegExp('valid until[\\s:]\\s*(?:[a-z]{3,9},\\s*)?(' + dateShort.source + ')', 'i'),
    new RegExp('ends?[\\s:]\\s*(?:[a-z]{3,9},\\s*)?(' + dateShort.source + ')', 'i'),
  ];
  const candidates = document.querySelectorAll<HTMLElement>(
    '[class*="offer"], [class*="promotion"], [class*="expiry"], [class*="terms"], [data-testid*="offer"], [data-testid*="promotion"], p, span, div'
  );
  for (const el of candidates) {
    const text = el.textContent || '';
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return toISODate(match[1]);
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

function getAsdaPrice(label: string, root: ParentNode = document): string | null {
  const container = qs<HTMLElement>('[data-testid="txt-pdp-product-price"]', root);
  if (!container) return null;
  const paragraphs = qsa<HTMLElement>('p', container);
  for (const p of paragraphs) {
    const span = qs<HTMLElement>('span', p);
    if (span?.textContent?.trim().toLowerCase() === label) {
      return p.textContent?.trim() || null;
    }
  }
  return null;
}

function getBreadcrumbCrumbs(root: ParentNode = document): string[] {
  const selectors = [
    '[data-auto="breadcrumb"] a',
    '[data-testid="breadcrumb"] a',
    'nav[aria-label="breadcrumb"] a',
    '.breadcrumbs a',
    '.breadcrumb a',
    'ol[class*="breadcrumb"] a',
    '.chakra-breadcrumb__list-item a',
  ];
  const links = qsa<HTMLElement>(selectors.join(','), root);
  const crumbs: string[] = [];
  for (const link of links) {
    const text = link.textContent?.trim();
    if (text) crumbs.push(text);
  }
  return crumbs;
}

function hasFrozenSignal(root: ParentNode = document, title: string | null): boolean {
  if (title && /frozen/i.test(title)) return true;
  return getBreadcrumbCrumbs(root).some(c => /frozen/i.test(c));
}

function extractCategory(root: ParentNode = document): string | null {
  const crumbs = getBreadcrumbCrumbs(root);
  const raw = crumbs.length > 0 ? crumbs[crumbs.length - 1] : null;
  return raw ? normalizeCategory(raw) : null;
}

function extractDealText(root: ParentNode = document): string | null {
  const pattern = /(\d+\s*for\s*£?\s*\d+\.?\d*|for\s*£?\s*\d+\.?\d*)/i;
  let excludeSel = '[class*="carousel"], [class*="cross-sell"], [class*="crosssell"], [class*="related"], [class*="recommend"], [class*="recently"], [data-testid*="carousel"], [data-testid*="recommend"]';
  // ---- Morrisons ----
  if (isStore('morrisons')) {
    excludeSel += ', [data-test*="carousel"], [data-test*="related"], [data-test*="recommend"], [data-test*="you-might"]';
  }
  const priceEl = qs<HTMLElement>(
    '[data-testid="txt-pdp-product-price"], [class*="product-pricing"], [data-testid*="contextual-price"], [class*="value-bar"], .ds-c-price',
    root
  );
  const priceRect = priceEl?.getBoundingClientRect();

  const candidates = qsa<HTMLElement>(
    '[class*="offer"], [class*="promotion"], [class*="multibuy"], [class*="multi-buy"], [class*="deal"], [class*="caption-module"], [class*="captionNectar"], [data-testid*="offer"], [data-testid*="promotion"], [data-testid*="multi"], [data-locator*="offer"], a[data-locator], p, span, div',
    root
  );

  let best: string | null = null;
  for (const el of candidates) {
    if (el.closest(excludeSel)) continue;
    const text = el.textContent?.trim() || '';
    if (text.length === 0 || text.length > 120) continue;
    if (!pattern.test(text)) continue;

    const isCaption = el.classList.contains('caption-module') || el.closest('[class*="caption-module"]') != null;
    const rect = el.getBoundingClientRect();
    if (priceRect && !isCaption) {
      const overlap = rect.left < priceRect.right && rect.right > priceRect.left;
      const centerY = (rect.top + rect.bottom) / 2;
      const inBand = centerY > priceRect.top - 200 && centerY < priceRect.bottom + 250;
      if (!overlap || !inBand) continue;
    }
    if (!best || text.length < best.length) best = text;
  }
  return best;
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

function getSinglePriceText(root: ParentNode, dealText: string | null): string | null {
  const selectors = [
    '.ds-c-price__price[data-colour="subtle"]',
    '[data-testid="pd-retail-price"]',
    '.pd__cost__retail-price',
    '.pt__cost__retail-price',
    '[data-auto="price-per-quantity-weight"]',
    '.price-main__integer',
    '[data-testid="product-tile-price"]',
    '.product-price',
    '.online-components-product-tile-price__text',
  ];
  for (const sel of selectors) {
    const el = qs<HTMLElement>(sel, root);
    const text = el?.textContent?.trim();
    if (!text) continue;
    if (dealText && dealText.length > 3 && text.includes(dealText)) continue;
    return text;
  }
  return null;
}

function extractFromDom(): Partial<ExtractedProduct> {
  const root = getProductRoot();

  const dealText = extractDealText(root);

  let priceText: string | null = null;
  let wasPriceText: string | null = null;
  let loyaltyPriceText: string | null = null;
  let imageUrl: string | null = null;
  let title: string | null = null;

  // ---- Sainsbury's ----
  if (isStore('sainsburys')) {
    priceText = getSinglePriceText(root, dealText) || getText([
      '.ds-c-price__price[data-colour="subtle"]',
      '[data-testid="pd-retail-price"]',
      '.pd__cost__retail-price',
    ], root);
    wasPriceText = getText([
      '[data-auto="was-price"]',
      '.price--was',
      '.product-price--previous',
      '.pt__cost__retail-price--was',
      '[data-testid="was-price"]',
    ], root);
    loyaltyPriceText = getText([
      '.ds-c-price__price[data-colour="nectar"]',
      '.pd__cost--price',
      '.nectar-offer',
      '[class*="nectar-price"]',
      '[data-testid*="nectar"]',
      '.product-pricing__nectar',
    ], root) || getLoyaltyPriceByPattern(root);
    imageUrl = getAttr([
      'img.pd__image',
      'img[data-auto="product-image"]',
      '.product-image img',
    ], 'src', root);
    title = getText([
      'h1',
      '[data-auto="product-title"]',
    ], root);
  }

  // ---- Tesco ----
  if (isStore('tesco')) {
    priceText = getSinglePriceText(root, dealText) || getText([
      '[data-testid="product-tile-price"]',
      '.price-main__integer',
      '.product-price',
    ], root);
    wasPriceText = getText([
      '[data-auto="was-price"]',
      '.product-price--previous',
      '[data-testid="was-price"]',
    ], root);
    loyaltyPriceText = getText([
      '[data-auto="clubcard-price"]',
      '.price--clubcard',
      '.clubcard-price',
      '[data-testid="clubcard-price"]',
      '[data-testid="contextual-price-text"]',
      '.ddsweb-value-bar__content-text',
    ], root) || getLoyaltyPriceByPattern(root);
    imageUrl = getAttr([
      'img[src*="digitalcontent.api.tesco.com"]',
      '[data-testid="product-tile-image"] img',
      'img[data-auto="product-image"]',
    ], 'src', root);
    title = getText([
      'h1',
      '[data-testid="product-tile-title"]',
      '[data-auto="product-title"]',
    ], root);
  }

  // ---- ASDA ----
  if (isStore('asda')) {
    priceText = getSinglePriceText(root, dealText) || getAsdaPrice('was', root) || getAsdaPrice('actual price', root);
    wasPriceText = getText([
      '[data-auto="was-price"]',
      '.price--was',
      '.product-price--previous',
      '[data-testid="was-price"]',
    ], root);
    loyaltyPriceText = getText([
      '[data-testid="contextual-price-text"]',
      '[class*="asda-price"]',
      '[data-testid*="asda-price"]',
      '[data-testid*="reduced"]',
      '[class*="price-lock"]',
      '[data-testid*="price-lock"]',
    ], root) || getAsdaPrice('actual price', root) || getLoyaltyPriceByPattern(root);
    imageUrl = getAttr([
      'img[data-testid="img"]',
      '.product-image img',
      'img[data-auto="product-image"]',
    ], 'src', root);
    title = getText([
      'h1',
      '[data-testid="txt-pdp-product-name"]',
    ], root);
  }

  // ---- Morrisons ----
  if (isStore('morrisons')) {
    priceText = getSinglePriceText(root, dealText) || getText([
      '.product-price',
      '.price-main__integer',
    ], root);
    wasPriceText = getText([
      '[data-auto="was-price"]',
      '.price--was',
      '.product-price--previous',
      '[data-testid="was-price"]',
    ], root);
    loyaltyPriceText = getText([
      '[class*="more-card"]',
      '[data-testid*="more-card"]',
    ], root) || getLoyaltyPriceByPattern(root);
    imageUrl = getAttr([
      'img[data-auto="product-image"]',
      '.product-image img',
    ], 'src', root);
    title = getText([
      'h1',
      '[data-auto="product-title"]',
    ], root);
  }

  // ---- Generic fallback (M&S, Aldi, Lidl, Co-op, Waitrose, Iceland, Ocado) ----
  priceText = priceText || getSinglePriceText(root, dealText) || getAsdaPrice('was', root) || getAsdaPrice('actual price', root);
  wasPriceText = wasPriceText || getText([
    '[data-auto="was-price"]',
    '.price--was',
    '.product-price--previous',
    '.pt__cost__retail-price--was',
    '[data-testid="was-price"]',
  ], root);
  loyaltyPriceText = loyaltyPriceText || getText([
    '.ds-c-price__price[data-colour="nectar"]',
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
    '[data-testid*="asda-price"]',
    '[class*="price-lock"]',
    '[data-testid*="price-lock"]',
  ], root) || getAsdaPrice('actual price', root) || getLoyaltyPriceByPattern(root);

  imageUrl = imageUrl || getAttr([
    'img.pd__image',
    'img[data-auto="product-image"]',
    '.product-image img',
    'img[src*="digitalcontent.api.tesco.com"]',
    '[data-testid="product-tile-image"] img',
    'img[data-testid="img"]',
  ], 'src', root);

  title = title || getText([
    'h1',
    '[data-auto="product-title"]',
    '[data-testid="product-tile-title"]',
    '[data-testid="txt-pdp-product-name"]',
  ], root);

  const titleCategory = title ? normalizeCategory(title) : 'Other';
  const category = hasFrozenSignal(root, title)
    ? 'Frozen'
    : titleCategory === 'Other'
      ? extractCategory(root) ?? 'Other'
      : titleCategory;

  let finalPrice = parsePrice(priceText);
  let finalWasPrice = parsePrice(wasPriceText);
  let finalLoyaltyPrice = parsePrice(loyaltyPriceText);

  if (isStore('morrisons')) {
    const promoEls = document.querySelectorAll<HTMLElement>('[class*="--promotion"]');
    for (const el of promoEls) {
      const text = el.textContent || '';
      const match = text.match(/Now\s*£([\d.]+),?\s*Was\s*£([\d.]+)/i);
      if (match) {
        finalPrice = parseFloat(match[2]);
        finalLoyaltyPrice = parseFloat(match[1]);
        finalWasPrice = null;
        break;
      }
    }
  }

  return {
    name: title,
    price: finalPrice,
    was_price: finalWasPrice,
    loyalty_price: finalLoyaltyPrice,
    offer_deal: extractDealText(root),
    offer_expires_at: extractOfferExpiry(),
    image_url: imageUrl,
    product_url: window.location.href,
    category,
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

function isStore(...ids: string[]): boolean {
  const store = detectStore();
  return store !== null && ids.includes(store.id);
}

export function extractProduct(): ExtractedProduct | null {
  const store = detectStore();
  if (!store) return null;

  const jsonLd = extractFromJsonLd();
  const dom = extractFromDom();

  const domCategory = dom.category === 'Other' ? jsonLd?.category ?? dom.category : dom.category;
  const jsonLdFrozen = jsonLd?.category ? /frozen/i.test(jsonLd.category) : false;
  const category = domCategory === 'Frozen' || jsonLdFrozen ? 'Frozen' : domCategory;

  return {
    name: dom.name || jsonLd?.name || null,
    price: dom.price ?? jsonLd?.price ?? null,
    loyalty_price: dom.loyalty_price ?? null,
    was_price: dom.was_price ?? null,
    offer_deal: dom.offer_deal ?? null,
    offer_expires_at: dom.offer_expires_at ?? jsonLd?.offer_expires_at ?? null,
    image_url: jsonLd?.image_url ?? dom.image_url ?? null,
    product_url: jsonLd?.product_url || dom.product_url || window.location.href,
    category,
    store: store.name,
    store_logo: store.logo,
    unit: null,
    currency: 'GBP',
  };
}
