import type { ExtractedProduct } from '../types';

interface JsonLdOffer {
  '@type'?: string | string[];
  price?: string;
  lowPrice?: string;
  priceCurrency?: string;
  url?: string;
  priceValidUntil?: string;
}

interface JsonLdProduct {
  '@type': string | string[];
  name?: string;
  image?: string | string[];
  sku?: string;
  gtin13?: string;
  brand?: { name?: string } | string;
  category?: string;
  offers?: JsonLdOffer | JsonLdOffer[];
  description?: string;
}

function parsePrice(text: string | undefined | null): number | null {
  if (!text) return null;
  const cleaned = text.replace(/,/g, '');

  if (/\d\s*for\s*£?\s*\d/.test(cleaned)) return null;

  if (cleaned.includes('\u00A3')) {
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

// Carousel / cross-sell nodes live inside <main> and contaminate broad scans.
// Hero containers below hold only the main PDP price block.
const EXCLUDE_SEL = '[class*="carousel"], [class*="Carousel"], [class*="ddsweb-carousel"], [class*="ds-c-carousel"], [class*="carousel__"], [class*="cross-sell"], [class*="crosssell"], [class*="related"], [class*="recommend"], [class*="recently"], [data-testid*="carousel"], [data-testid*="recommend"], [data-test*="carousel"], [data-test*="recommend"], [data-testid="product-information-roundel"], [data-testid*="roundel"]';

function isExcluded(el: Element | null | undefined): boolean {
  try {
    return !!el?.closest?.(EXCLUDE_SEL);
  } catch {
    return false;
  }
}

const HERO_SELS: Record<string, string[]> = {
  sainsburys: [
    '[data-testid="pdp-meta-sticky"]',
    '[data-testid="gw-product-price-container"]',
    '[data-testid="gw-product-retail-price"]',
  ],
  tesco: [
    // Title section first: stable across hashed renames, holds price +
    // promotion + terms together, excludes the sticky banner (sibling outside
    // the section) automatically. :has supported Chrome 105+.
    'section:has([data-auto="pdp-product-title"])',
    '[class*="clubcard-promotion"]',
    '[data-auto="pdp-buy-box-quantity-controls-container"]',
    '[data-auto="pdp-buy-box"]',
    '[data-auto="pdp-product-tile-messaging"]',
  ],
};

function getHeroRoot(storeId?: string): ParentNode {
  const sels = (storeId && HERO_SELS[storeId]) || [];
  const seen = new Set<Element>();
  const cands: HTMLElement[] = [];
  for (const sel of sels) {
    let els: NodeListOf<HTMLElement>;
    try {
      els = document.querySelectorAll<HTMLElement>(sel);
    } catch {
      continue;
    }
    for (const el of els) {
      if (seen.has(el)) continue;
      seen.add(el);
      if (isExcluded(el) || isHidden(el)) continue;
      if (cands.length >= 10) break;
      cands.push(el);
    }
  }
  if (cands.length === 0) return getProductRoot();
  // Tesco renders hidden breakpoint duplicates + a sticky banner holding the
  // regular price only. Score candidates so the container holding the offer
  // (loyalty + terms) wins over price-only copies. Tie = document order.
  let best = cands[0] as HTMLElement;
  let bestScore = -1;
  for (const c of cands) {
    const sc = scoreHeroCandidate(c);
    if (sc > bestScore) {
      bestScore = sc;
      best = c;
    }
  }
  return best;
}

function isHidden(el: HTMLElement): boolean {
  if (el.hasAttribute('hidden')) return true;
  try {
    if (el.getClientRects().length === 0) return true;
  } catch {
    return false;
  }
  return false;
}

const HERO_LOYALTY_MARKER = '.ds-c-price__price[data-colour="nectar"], [data-auto="clubcard-price"], .price--clubcard, .clubcard-price, [data-testid="clubcard-price"], [data-testid="contextual-price-text"], .ddsweb-value-bar__content-text, .nectar-offer, [class*="nectar-price"], [data-testid*="nectar"], [class*="more-card"], [class*="member-price"], [class*="loyalty"]';
const HERO_OFFER_MARKER = '.ddsweb-value-bar__terms, [class*="value-bar__terms"], [class*="termsText"], [class*="alert__message"], .ds-c-alert, .expiry-date, [class*="--promotion"]';
const HERO_PRICE_MARKER = '.ds-c-price__price[data-colour="subtle"], .online-components-product-tile-price__text, [data-testid="product-tile-price"], [data-testid="pd-retail-price"], [data-testid="txt-pdp-product-price"]';

function scoreHeroCandidate(el: HTMLElement): number {
  let score = 0;
  try {
    if (el.querySelector(HERO_LOYALTY_MARKER)) score += 4;
    if (el.querySelector(HERO_OFFER_MARKER)) score += 2;
    if (el.querySelector(HERO_PRICE_MARKER)) score += 1;
  } catch {
    // Static selectors only; ignore query failures.
  }
  return score;
}

function qs<K extends HTMLElement>(sel: string, root: ParentNode): K | null {
  return root.querySelector<K>(sel);
}

function qsa<K extends HTMLElement>(sel: string, root: ParentNode): NodeListOf<K> {
  return root.querySelectorAll<K>(sel);
}

function getText(selectors: string[], root: ParentNode = document): string | null {
  for (const sel of selectors) {
    const els = (root as ParentNode).querySelectorAll<HTMLElement>(sel);
    for (const el of els) {
      if (isExcluded(el)) continue;
      if (el?.textContent?.trim()) return el.textContent.trim();
    }
  }
  return null;
}

function getLoyaltyPriceByPattern(root: ParentNode = getProductRoot()): string | null {
  const patterns = [
    /(?:nectar|clubcard|member|loyalty|more\s*card|partner)\s*(?:price|saving)?[:\s]*£?\s*(\d+\.?\d*)/i,
    /£\s*(\d+\.?\d*)\s*(?:with|when you use|using)\s*(?:nectar|clubcard|member|loyalty)/i,
  ];
  const candidates = qsa<HTMLElement>(
    '[class*="price"], [class*="loyalty"], [class*="member"], [class*="nectar"], [class*="clubcard"], [data-testid*="price"], [data-testid*="loyalty"]',
    root
  );
  for (const el of candidates) {
    if (isExcluded(el)) continue;
    // Skip aggregating containers (carousel cards bundle heading + many prices).
    if (el.children.length > 6) continue;
    const text = el.textContent || '';
    if (text.length === 0 || text.length > 300) continue;
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

function extractOfferExpiry(storeId?: string, hero?: ParentNode, hasOfferSignal?: boolean): string | null {
  // Trusted store banners are self-qualifying: Sainsbury alert, Tesco terms,
  // Morrisons promotion nodes only render with a real offer, so they return
  // ungated. The generic fallback below stays gated on hasOfferSignal.
  const heroScope: ParentNode = hero || getProductRoot();
  const pageScope: ParentNode = getProductRoot();
  // Trusted banners (Sainsbury alert, Tesco terms) can sit outside the hero
  // price container as page-level siblings. Search hero first, page second.
  const scopes: ParentNode[] = heroScope === pageScope ? [heroScope] : [heroScope, pageScope];
  const dateShort = /\d{1,2}\s+\w+\s+\d{4}/;

  // ---- Sainsbury's ----
  if (storeId === 'sainsburys') {
    for (const scope of scopes) {
      const sainsburysEl = (scope as ParentNode).querySelector<HTMLElement>('.expiry-date');
      if (sainsburysEl && !isExcluded(sainsburysEl) && sainsburysEl?.textContent) {
        const match = sainsburysEl.textContent.trim().match(dateShort);
        if (match) return toISODate(match[0]);
      }

      const sainsburysAlerts = (scope as ParentNode).querySelectorAll<HTMLElement>(
        '[class*="alert__message"], [class*="alert-message"], .ds-c-alert'
      );
      for (const alertEl of sainsburysAlerts) {
        if (isExcluded(alertEl) || !alertEl?.textContent) continue;
        const text = alertEl.textContent;
        if (text.length > 500) continue;
        // Site-wide alerts (cookies, baskets) carry dates too. Only offer banners qualify.
        if (!/nectar|offer|price|save/i.test(text)) continue;
        const match = text.match(/(\d{1,2}\s+\w+\s+\d{4})/);
        if (match) return toISODate(match[1]);
      }
    }
  }

  // ---- Tesco ----
  if (storeId === 'tesco') {
    const tescoSel = '.ddsweb-value-bar__terms, [class*="value-bar__terms"], [class*="termsText"]';
    for (const scope of scopes) {
      const tescoEls = (scope as ParentNode).querySelectorAll<HTMLElement>(tescoSel);
      for (const el of tescoEls) {
        if (isExcluded(el)) continue;
        const text = el.textContent?.trim() || '';
        if (!/offer|clubcard|promotion/i.test(text)) continue;
        const match = text.match(/until\s+(\d{2}\/\d{2}\/\d{4})/);
        if (match) return toISODate(match[1]);
      }
    }
  }

  // ---- Morrisons ----
  if (storeId === 'morrisons') {
    for (const scope of scopes) {
      const morrisonsEls = (scope as ParentNode).querySelectorAll<HTMLElement>('[class*="--promotion"]');
      for (const el of morrisonsEls) {
        if (isExcluded(el)) continue;
        const text = el.textContent || '';
        if (!/offer/i.test(text)) continue;
        const match =
          text.match(/(?:order\s*by|until|before|valid until)\s+(\d{2}\/\d{2}\/\d{4})/i) ||
          text.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (match) return toISODate(match[1]);
      }
    }
  }

  // ---- Generic fallback: gated, hero-scoped, offer containers only ----
  // Never bare p/span/div: Tesco carousel titles leaked dates onto regular items.
  if (!hasOfferSignal) return null;
  const patterns = [
    /until\s+(\d{2}\/\d{2}\/\d{4})/,
    new RegExp('until[\\s:]\\s*(?:[a-z]{3,9},\\s*)?(' + dateShort.source + ')', 'i'),
    new RegExp('expires?[\\s:]\\s*(?:[a-z]{3,9},\\s*)?(' + dateShort.source + ')', 'i'),
    new RegExp('valid until[\\s:]\\s*(?:[a-z]{3,9},\\s*)?(' + dateShort.source + ')', 'i'),
    new RegExp('ends?[\\s:]\\s*(?:[a-z]{3,9},\\s*)?(' + dateShort.source + ')', 'i'),
  ];
  const candidates = qsa<HTMLElement>(
    '[class*="offer"], [class*="promotion"], [class*="expiry"], [class*="terms"], [data-testid*="offer"], [data-testid*="promotion"]',
    heroScope
  );
  let scanned = 0;
  for (const el of candidates) {
    if (++scanned > 200) break;
    if (isExcluded(el)) continue;
    const text = el.textContent || '';
    if (text.length === 0 || text.length > 300) continue;
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return toISODate(match[1]);
    }
  }
  return null;
}

function getAttr(selectors: string[], attr: string, root: ParentNode = document): string | null {
  for (const sel of selectors) {
    const els = (root as ParentNode).querySelectorAll<HTMLElement>(sel);
    for (const el of els) {
      if (isExcluded(el)) continue;
      const val = el?.getAttribute(attr);
      if (val) return val;
    }
  }
  return null;
}

function getAsdaPrice(label: string, root: ParentNode = document): string | null {
  const containers = (root as ParentNode).querySelectorAll<HTMLElement>('[data-testid="txt-pdp-product-price"]');
  for (const container of containers) {
    if (isExcluded(container)) continue;
    const paragraphs = container.querySelectorAll<HTMLElement>('p');
    for (const p of paragraphs) {
      const span = p.querySelector<HTMLElement>('span');
      if (span?.textContent?.trim().toLowerCase() === label) {
        return p.textContent?.trim() || null;
      }
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

function extractBrand(root: ParentNode = document): string | null {
  const el = qs<HTMLElement>(
    '[itemprop="brand"], [data-auto*="brand" i], [data-testid*="brand" i], .product-brand, [class*="product-brand"]',
    root
  );
  const text = el?.textContent?.trim() || el?.getAttribute('content');
  return text || null;
}

const STORAGE_PATTERN = /refrigerat|keep chilled|microwave from chilled|keep cool|serve chilled|store in a cool dry|cool dry|do not freeze|do not refreeze|suitable for (home )?freez|keep frozen|store frozen|ambient|store cupboard|no refrigeration|use by|eat within|-18/i;

function extractStorageSentence(text: string): string | null {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!STORAGE_PATTERN.test(cleaned)) return null;
  const sentences = cleaned.split(/(?<=[.!?;])\s+|\n+/);
  for (const sentence of sentences) {
    if (STORAGE_PATTERN.test(sentence)) {
      const trimmed = sentence.trim();
      if (trimmed) return trimmed.slice(0, 300);
    }
  }
  const match = cleaned.match(STORAGE_PATTERN);
  if (match?.index !== undefined) {
    return cleaned.slice(Math.max(0, match.index - 120), match.index + 180).trim().slice(0, 300);
  }
  return null;
}

function extractStorageText(root: ParentNode = document, storeId?: string): string | null {
  const storeSelectors: Record<string, string[]> = {
    sainsburys: [
      '[class*="preparation"]', '[class*="storage"]', '[class*="cooking"]',
      '[data-auto*="preparation"]', '[data-auto*="storage"]', '[data-auto*="cooking"]',
      '.pd__preparation', '.pd__storage',
    ],
    tesco: [
      '[class*="preparation"]', '[class*="storage"]', '[class*="cooking"]',
      '[data-testid*="preparation"]', '[data-testid*="storage"]', '[data-testid*="cooking"]',
      '[class*="product-info"]',
    ],
  };
  const targeted = [
    ...(storeId && storeSelectors[storeId] ? storeSelectors[storeId] : []),
    '[class*="storage"]', '[class*="preparation"]', '[class*="cooking-instruction"]',
    '[data-testid*="storage"]', '[data-testid*="preparation"]', '[itemprop="storageInstructions"]',
  ];
  if (targeted.length > 0) {
    const els = qsa<HTMLElement>(targeted.join(','), root);
    for (const el of els) {
      const hit = el.textContent ? extractStorageSentence(el.textContent) : null;
      if (hit) return hit;
    }
  }

  const excludeSel = '[class*="carousel"], [class*="cross-sell"], [class*="crosssell"], [class*="related"], [class*="recommend"], [class*="recently"], [class*="header"], [class*="footer"], [class*="nav"]';
  const candidates = qsa<HTMLElement>('p, li, td, dd, span, div', root);
  let scanned = 0;
  for (const el of candidates) {
    if (++scanned > 400) break;
    if (el.closest(excludeSel)) continue;
    const text = el.textContent || '';
    if (text.length === 0 || text.length > 600) continue;
    // Leaf-ish nodes only: skip containers echoing many child matches.
    if (el.children.length > 4) continue;
    const hit = extractStorageSentence(text);
    if (hit) return hit;
  }
  return null;
}

function extractDealText(root: ParentNode = document, storeId?: string): string | null {
  // Second branch requires £: bare "for 4" (freshness copy: "Typically fresh
  // for 4 days") must never qualify. Multibuy without £ stays covered by
  // the first branch (\d+ for \d+: "3 for 2").
  const pattern = /(\d+\s*for\s*£?\s*\d+\.?\d*|for\s*£\s*\d+\.?\d*)/i;
  const FRESHNESS_RE = /typically|fresh\s+for|use\s+within|eat\s+within|keep\s+(chilled|refrigerated|frozen)|best\s+before/i;
  let excludeSel = EXCLUDE_SEL;
  // ---- Morrisons ----
  if (storeId === 'morrisons') {
    excludeSel += ', [data-test*="you-might"]';
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
    if (FRESHNESS_RE.test(text)) continue;
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

function normalizeType(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function extractFromJsonLd(): (Partial<ExtractedProduct> & { brand?: string | null }) | null {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '');
      const nodes = Array.isArray(data)
        ? data
        : Array.isArray(data['@graph'])
          ? data['@graph']
          : [data];
      for (const node of nodes) {
        const types = normalizeType(node['@type']);
        if (!types.includes('Product')) continue;

        const rawOffers = Array.isArray(node['offers'])
          ? node['offers']
          : node['offers']
            ? [node['offers']]
            : [];

        let price: number | null = null;
        let offerUrl: string | undefined;
        let offerExpiresAt: string | null = null;

        for (const offer of rawOffers) {
          const candidate = Math.min(
            parsePrice(offer?.price) ?? Infinity,
            parsePrice(offer?.lowPrice) ?? Infinity
          );
          if (candidate === Infinity) continue;
          if (price !== null && candidate >= price) continue;

          price = candidate;
          offerUrl = offer?.url;
          const offerTypes = normalizeType(offer?.['@type']);
          const isAggregate = offerTypes.includes('AggregateOffer');
          if (offerTypes.includes('Offer') && !isAggregate) {
            offerExpiresAt = offer?.priceValidUntil ? toISODate(offer.priceValidUntil) : null;
          } else {
            offerExpiresAt = null;
          }
        }

        const image = Array.isArray(node['image']) ? node['image'][0] : node['image'];
        const brand = typeof node['brand'] === 'string'
          ? node['brand']
          : node['brand']?.name || null;
        return {
          name: node['name'] || null,
          brand,
          price,
          image_url: image || null,
          product_url: offerUrl || window.location.href,
          offer_expires_at: offerExpiresAt,
          category: node['category'] || null,
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
    const els = (root as ParentNode).querySelectorAll<HTMLElement>(sel);
    for (const el of els) {
      if (isExcluded(el)) continue;
      const text = el?.textContent?.trim();
      if (!text) continue;
      if (dealText && dealText.length > 3 && text.includes(dealText)) continue;
      return text;
    }
  }
  return null;
}

function cleanDealText(deal: string | null): string | null {
  if (!deal) return null;
  return deal
    .replace(/\s*-\s*Selected\s+[^-]+$/i, '')
    .replace(/\s*-\s*Cheapest\s+Product\s+Free/i, '')
    .trim() || null;
}

function extractFromDom(): Partial<ExtractedProduct> {
  const storeId = detectStore()?.id;
  const root = getProductRoot();
  const hero = getHeroRoot(storeId);
  // Price signals come from hero only. Title / image may live outside buy-box.
  const priceScope = hero;

  const dealText = extractDealText(priceScope, storeId) || extractDealText(root, storeId);

  let priceText: string | null = null;
  let wasPriceText: string | null = null;
  let loyaltyPriceText: string | null = null;
  let imageUrl: string | null = null;
  let title: string | null = null;

  // ---- Sainsbury's ----
  if (storeId === 'sainsburys') {
    priceText = getSinglePriceText(priceScope, dealText) || getText([
      '.ds-c-price__price[data-colour="subtle"]',
      '[data-testid="pd-retail-price"]',
      '.pd__cost__retail-price',
    ], priceScope);
    wasPriceText = getText([
      '[data-auto="was-price"]',
      '.price--was',
      '.product-price--previous',
      '.pt__cost__retail-price--was',
      '[data-testid="was-price"]',
    ], priceScope);
    // Strict: Nectar badge only inside hero price container.
    // .pd__cost--price removed: regular price container, not loyalty.
    // No loose pattern fallback: carousel upsell text caused false loyalty.
    loyaltyPriceText = getText([
      '.ds-c-price__price[data-colour="nectar"]',
      '.nectar-offer',
      '[class*="nectar-price"]',
      '[data-testid*="nectar"]',
    ], priceScope);
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
  if (storeId === 'tesco') {
    priceText = getSinglePriceText(priceScope, dealText) || getText([
      '[data-testid="product-tile-price"]',
      '.price-main__integer',
      '.product-price',
    ], priceScope);
    wasPriceText = getText([
      '[data-auto="was-price"]',
      '.product-price--previous',
      '[data-testid="was-price"]',
    ], priceScope);
    loyaltyPriceText = getText([
      '[data-auto="clubcard-price"]',
      '.price--clubcard',
      '.clubcard-price',
      '[data-testid="clubcard-price"]',
      '[data-testid="contextual-price-text"]',
      '.ddsweb-value-bar__content-text',
    ], priceScope) || getLoyaltyPriceByPattern(priceScope);
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
  if (storeId === 'asda') {
    priceText = getSinglePriceText(priceScope, dealText) || getAsdaPrice('actual price', priceScope);
    wasPriceText = getAsdaPrice('was', priceScope) || getText([
      '[data-auto="was-price"]',
      '.price--was',
      '.product-price--previous',
      '[data-testid="was-price"]',
    ], priceScope);
    loyaltyPriceText = getText([
      '[data-testid="contextual-price-text"]',
      '[class*="asda-price"]',
      '[data-testid*="asda-price"]',
      '[data-testid*="reduced"]',
      '[class*="price-lock"]',
      '[data-testid*="price-lock"]',
    ], priceScope) || getLoyaltyPriceByPattern(priceScope);
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
  if (storeId === 'morrisons') {
    priceText = getSinglePriceText(priceScope, dealText) || getText([
      '.product-price',
      '.price-main__integer',
    ], priceScope);
    wasPriceText = getText([
      '[data-auto="was-price"]',
      '.price--was',
      '.product-price--previous',
      '[data-testid="was-price"]',
    ], priceScope);
    loyaltyPriceText = getText([
      '[class*="more-card"]',
      '[data-testid*="more-card"]',
    ], priceScope) || getLoyaltyPriceByPattern(priceScope);
    imageUrl = getAttr([
      'img[data-auto="product-image"]',
      '.product-image img',
    ], 'src', root);
    title = getText([
      'h1',
      '[data-auto="product-title"]',
    ], root);
  }

  // ---- M&S ----
  if (storeId === 'marksandspencer') {
    priceText = getText([
      '[class*="priceWrapper"]',
      '.price_priceWrapper__Yp_17',
    ], priceScope);
    // Gallery li class contains "carousel" (image-grid-and-carousel) —
    // EXCLUDE_SEL drops it inside getAttr. Scan directly: these selectors
    // target the PDP gallery only, safe without the cross-sell exclusion.
    const gallerySels = [
      '[class*="image-gallery_isCurrent"] img',
      'img[data-tagg="gallery-image"]',
      '[class*="image-gallery_slide"] img',
    ];
    imageUrl = null;
    for (const sel of gallerySels) {
      const img = qs<HTMLImageElement>(sel, root);
      const src = img?.getAttribute('src');
      if (src) {
        imageUrl = src;
        break;
      }
    }
    title = getText([
      'h1',
    ], root);
  }

  // ---- Generic fallback (Aldi, Lidl, Co-op, Waitrose, Iceland, Ocado) ----
  priceText = priceText || getSinglePriceText(priceScope, dealText) || getAsdaPrice('actual price', priceScope) || getAsdaPrice('was', priceScope);
  wasPriceText = wasPriceText || getText([
    '[data-auto="was-price"]',
    '.price--was',
    '.product-price--previous',
    '.pt__cost__retail-price--was',
    '[data-testid="was-price"]',
  ], priceScope);
  loyaltyPriceText = loyaltyPriceText || getText([
    '.ds-c-price__price[data-colour="nectar"]',
    '[data-auto="clubcard-price"]',
    '.price--clubcard',
    '.clubcard-price',
    '[data-testid="clubcard-price"]',
    '[data-testid="contextual-price-text"]',
    '.ddsweb-value-bar__content-text',
    '.nectar-offer',
    '[class*="nectar-price"]',
    '[data-testid*="nectar"]',
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
  ], priceScope) || getLoyaltyPriceByPattern(priceScope);

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

  // Worker owns taxonomy. Client sends null guess plus signals.
  const category: string | null = null;

  let finalPrice = parsePrice(priceText);
  let finalWasPrice = parsePrice(wasPriceText);
  let finalLoyaltyPrice = parsePrice(loyaltyPriceText);

  // Loyalty duplicating regular price = false positive. Null it.
  if (finalLoyaltyPrice != null && finalPrice != null && finalLoyaltyPrice === finalPrice) {
    finalLoyaltyPrice = null;
  }

  // ASDA rollback: DOM labels "was £4.20 / actual price £4.00". Rollback is
  // loyalty pricing, not a was-strikethrough. Show was as regular price,
  // actual as Rollback price, no was_price. Regular item (actual only)
  // falls through untouched.
  if (storeId === 'asda' && finalWasPrice != null && finalPrice != null) {
    finalLoyaltyPrice = finalPrice;
    finalPrice = finalWasPrice;
    finalWasPrice = null;
  }

  if (storeId === 'morrisons') {
    // Promo price-container: promoted span + strikethrough original
    // (data-test="bop-price-original"). Two numbers = More Card offer:
    // original as regular price, promoted as More Card loyalty price.
    // Single number = regular price capture (this markup misses all
    // class-based price selectors).
    let handled = false;
    const priceContainers = (priceScope as ParentNode).querySelectorAll<HTMLElement>('[data-test="price-container"]');
    for (const container of priceContainers) {
      if (isExcluded(container)) continue;
      const spans = container.querySelectorAll<HTMLElement>('span');
      const numbers: { el: HTMLElement; value: number }[] = [];
      for (const span of spans) {
        const text = span.textContent?.trim() || '';
        const m = text.match(/£\s*(\d+\.?\d*)/);
        if (m) numbers.push({ el: span, value: parseFloat(m[1]) });
      }
      if (numbers.length === 1) {
        finalPrice = numbers[0].value;
        continue;
      }
      if (numbers.length !== 2) continue;
      let original = numbers.find(n => n.el.getAttribute('data-test') === 'bop-price-original');
      let promoted = numbers.find(n => n.el !== original);
      if (!original || !promoted) {
        // Fallback: markup order is promoted first, original second.
        promoted = numbers[0];
        original = numbers[1];
      }
      if (original.value === promoted.value) continue;
      finalPrice = original.value;
      finalLoyaltyPrice = promoted.value;
      finalWasPrice = null;
      handled = true;
      break;
    }

    if (!handled) {
      const promoEls = (priceScope as ParentNode).querySelectorAll<HTMLElement>('[class*="--promotion"]');
      for (const el of promoEls) {
        if (isExcluded(el)) continue;
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

    // Promotions-window card: "£3.00 - More Card Price" (h3 or promo text).
    // Loyalty only when container/Now-Was paths did not set it. First £ wins:
    // unit price "£13.64/kg" sits after "More Card Price", never matches.
    if (finalLoyaltyPrice == null) {
      const cardPattern = /£\s*(\d+\.?\d*)\s*[-–—]?\s*More\s*Card\s*Price/i;
      const cardHeads = (priceScope as ParentNode).querySelectorAll<HTMLElement>('h3[class*="--promotion"], [class*="--promotion"]');
      for (const el of cardHeads) {
        if (isExcluded(el)) continue;
        const text = el.textContent?.trim() || '';
        if (text.length === 0 || text.length > 120) continue;
        const match = text.match(cardPattern);
        if (match) {
          finalLoyaltyPrice = parseFloat(match[1]);
          break;
        }
      }
    }

    // Equality recheck: card loyalty duplicating regular price is a
    // false positive. Drop loyalty, keep price (regular-item display).
    if (finalLoyaltyPrice != null && finalPrice != null && finalLoyaltyPrice === finalPrice) {
      finalLoyaltyPrice = null;
    }
  }

  const cleanedDeal = cleanDealText(dealText);
  const hasOfferSignal = finalWasPrice != null || finalLoyaltyPrice != null || cleanedDeal != null;

  return {
    name: title,
    price: finalPrice,
    was_price: finalWasPrice,
    loyalty_price: finalLoyaltyPrice,
    offer_deal: cleanedDeal,
    offer_expires_at: extractOfferExpiry(storeId, priceScope, hasOfferSignal),
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

// Composite product-page signal: JSON-LD Product node OR extracted
// name + price. Drives overlay button visibility on store pages.
export function hasProductPageSignal(): boolean {
  if (extractFromJsonLd() != null) return true;
  const dom = extractFromDom();
  return dom.name != null && dom.price != null;
}

export function extractProduct(): ExtractedProduct | null {  const store = detectStore();
  if (!store) return null;

  const jsonLd = extractFromJsonLd();
  const dom = extractFromDom();

  // Worker owns taxonomy. Top-level guess always null.
  // Raw jsonLd.category stays inside category_signals only.
  const category: string | null = null;

  const name = dom.name || jsonLd?.name || null;
  const crumbs = getBreadcrumbCrumbs();
  const category_signals = {
    breadcrumb_raw: crumbs,
    breadcrumb_leaf: crumbs.length > 0 ? crumbs[crumbs.length - 1] : null,
    title: name,
    brand: jsonLd?.brand || extractBrand() || null,
    store_id: store.id,
    url_path: window.location.pathname,
    jsonld_category: jsonLd?.category || null,
    storage_text: extractStorageText(getProductRoot(), store.id),
  };

  // JSON-LD priceValidUntil only counts when DOM shows an offer.
  // Stops stale / template expiry leaking onto regular items.
  const domHasOffer = dom.was_price != null || dom.loyalty_price != null || dom.offer_deal != null;
  const offerExpiresAt = dom.offer_expires_at ?? (domHasOffer ? jsonLd?.offer_expires_at ?? null : null);

  return {
    name,
    price: dom.price ?? jsonLd?.price ?? null,
    loyalty_price: dom.loyalty_price ?? null,
    was_price: dom.was_price ?? null,
    offer_deal: cleanDealText(dom.offer_deal),
    offer_expires_at: offerExpiresAt,
    image_url: jsonLd?.image_url ?? dom.image_url ?? null,
    product_url: jsonLd?.product_url || dom.product_url || window.location.href,
    category,
    store: store.name,
    store_logo: store.logo,
    unit: null,
    currency: 'GBP',
    category_signals,
  };
}
