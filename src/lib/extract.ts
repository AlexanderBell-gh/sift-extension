import type { ExtractedProduct } from '../types';
import {
  DEFAULT_DEAL_ANCHOR,
  DEFAULT_EXPIRY,
  DEFAULT_FIELDS,
  detectStoreByHost,
  type ExpiryRule,
  type HeroScore,
  type StoreConfig,
} from './store-config';
import {
  formatProductDump,
  isDebugEnabled,
  markTrace,
  clearTrace,
  startTrace,
  stopTrace,
  type Trace,
} from './debug';

// ── Global: types + shared helpers ────────────────────────────────────────────

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

interface JsonLdResult {
  name: string | null;
  brand: string | null;
  price: number | null;
  image_url: string | null;
  product_url: string;
  offer_expires_at: string | null;
  category: string | null;
}

interface DomResult {
  name: string | null;
  price: number | null;
  was_price: number | null;
  loyalty_price: number | null;
  offer_price: number | null;
  offer_type: 'loyalty' | 'offer' | null;
  offer_deal: string | null;
  offer_expires_at: string | null;
  image_url: string | null;
  product_url: string;
}

interface PriceValues {
  price: number | null;
  was: number | null;
  loyalty: number | null;
  offer: number | null;
}

interface MergedFields {
  title: string[];
  image: string[];
  price: string[];
  was: string[];
  loyaltyPrice: string[];
  storage: string[];
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

function getProductRoot(): ParentNode {
  return (
    document.querySelector<HTMLElement>(
      'main, [role="main"], article, .product-detail, [data-auto="product-detail"], [data-testid="product-detail"]'
    ) || document
  );
}

// Carousel / cross-sell nodes live inside <main> and contaminate broad scans.
// Hero containers below hold only the main PDP price block. Neighbour carousels
// (Sainsbury's frequently-bought-together) carry other products' pricing, so
// any spelling of that section is excluded from every scoped scan.
const EXCLUDE_SEL =
  '[class*="carousel"], [class*="Carousel"], [class*="ddsweb-carousel"], [class*="ds-c-carousel"], [class*="carousel__"], [class*="cross-sell"], [class*="crosssell"], [class*="related"], [class*="recommend"], [class*="recently"], [data-testid*="carousel"], [data-testid*="recommend"], [data-test*="carousel"], [data-test*="recommend"], [data-testid="product-information-roundel"], [data-testid*="roundel"], [class*="frequently-bought"], [class*="frequentlybought" i], [data-testid*="frequently"]';

function isExcluded(el: Element | null | undefined): boolean {
  try {
    return !!el?.closest?.(EXCLUDE_SEL);
  } catch {
    return false;
  }
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

function scoreHeroCandidate(el: HTMLElement, score: HeroScore): number {
  let total = 0;
  try {
    if (el.querySelector(score.loyalty)) total += 4;
    if (el.querySelector(score.offer)) total += 2;
    if (el.querySelector(score.price)) total += 1;
  } catch {
    // Static selectors only; ignore query failures.
  }
  return total;
}

function getHeroRoot(cfg: StoreConfig): ParentNode {
  const selectors = cfg.hero?.selectors ?? [];
  const seen = new Set<Element>();
  const candidates: HTMLElement[] = [];
  for (const sel of selectors) {
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
      if (candidates.length >= 10) break;
      candidates.push(el);
    }
  }
  if (candidates.length === 0) return getProductRoot();

  // Tesco renders hidden breakpoint duplicates + a sticky banner holding the
  // regular price only. Score candidates so the container holding the offer
  // (loyalty + terms) wins over price-only copies. Tie = document order.
  const score = cfg.hero?.score;
  let best = candidates[0];
  let bestScore = -1;
  for (const candidate of candidates) {
    const value = score ? scoreHeroCandidate(candidate, score) : 0;
    if (value > bestScore) {
      bestScore = value;
      best = candidate;
    }
  }
  return best;
}

function matchedSelector(el: Element, selectors: string[]): string {
  for (const sel of selectors) {
    try {
      if (el.matches(sel)) return sel;
    } catch {
      // Ignore selector support errors; keep the first known selector as label.
    }
  }
  return selectors[0] ?? '';
}

function getText(field: string, selectors: string[], root: ParentNode): string | null {
  for (const sel of selectors) {
    for (const el of root.querySelectorAll<HTMLElement>(sel)) {
      if (isExcluded(el)) continue;
      const text = el.textContent?.trim();
      if (text) {
        markTrace(field, sel);
        return text;
      }
    }
  }
  return null;
}

function getAttr(
  field: string,
  selectors: string[],
  attr: string,
  root: ParentNode,
  ignoreExclude = false
): string | null {
  for (const sel of selectors) {
    for (const el of root.querySelectorAll<HTMLElement>(sel)) {
      if (!ignoreExclude && isExcluded(el)) continue;
      const value = el.getAttribute(attr);
      if (value) {
        markTrace(field, sel);
        return value;
      }
    }
  }
  return null;
}

// A price node repeating the deal text is the deal container, not a price.
function getPriceText(
  selectors: string[],
  root: ParentNode,
  dealText: string | null
): string | null {
  for (const sel of selectors) {
    for (const el of root.querySelectorAll<HTMLElement>(sel)) {
      if (isExcluded(el)) continue;
      const text = el.textContent?.trim();
      if (!text) continue;
      if (dealText && dealText.length > 3 && text.includes(dealText)) continue;
      markTrace('price', sel);
      return text;
    }
  }
  return null;
}

const LOYALTY_PATTERNS = [
  /(?:nectar|clubcard|member|loyalty|more\s*card|partner)\s*(?:price|saving)?[:\s]*£?\s*(\d+\.?\d*)/i,
  /£\s*(\d+\.?\d*)\s*(?:with|when you use|using)\s*(?:nectar|clubcard|member|loyalty)/i,
];

function getLoyaltyPriceByPattern(root: ParentNode): string | null {
  const candidates = root.querySelectorAll<HTMLElement>(
    '[class*="price"], [class*="loyalty"], [class*="member"], [class*="nectar"], [class*="clubcard"], [data-testid*="price"], [data-testid*="loyalty"]'
  );
  for (const el of candidates) {
    if (isExcluded(el)) continue;
    // Skip aggregating containers (carousel cards bundle heading + many prices).
    if (el.children.length > 6) continue;
    const text = el.textContent || '';
    if (text.length === 0 || text.length > 300) continue;
    for (const pattern of LOYALTY_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        markTrace('loyalty', '[class*="price"] (text pattern)');
        return match[0];
      }
    }
  }
  return null;
}

function toISODate(raw: string): string {
  const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slash) return `${slash[3]}-${slash[2]}-${slash[1]}`;

  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
    jan: '01', feb: '02', mar: '03', apr: '04', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const text = raw.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
  if (text) {
    const month = months[text[2].toLowerCase()];
    if (month) return `${text[3]}-${month}-${String(text[1]).padStart(2, '0')}`;
  }

  return raw;
}

// Trusted store banners are self-qualifying: they only render with a real
// offer, so their rules run ungated. The generic rule stays gated.
function resolveExpiry(
  rule: ExpiryRule,
  scopes: ParentNode[],
  hasOfferSignal: boolean
): string | null {
  if (rule.gate && !hasOfferSignal) return null;
  const joined = rule.selectors.join(',');
  for (const scope of scopes) {
    let scanned = 0;
    for (const el of scope.querySelectorAll<HTMLElement>(joined)) {
      if (++scanned > 200) break;
      if (isExcluded(el)) continue;
      const text = el.textContent?.trim() || '';
      if (text.length === 0 || text.length > 300) continue;
      if (rule.require && !rule.require.test(text)) continue;
      for (const pattern of rule.patterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
          markTrace('expiry', matchedSelector(el, rule.selectors));
          return toISODate(match[1]);
        }
      }
    }
  }
  return null;
}

function getBreadcrumbCrumbs(root: ParentNode): string[] {
  const selectors = [
    '[data-auto="breadcrumb"] a',
    '[data-testid="breadcrumb"] a',
    'nav[aria-label="breadcrumb"] a',
    '.breadcrumbs a',
    '.breadcrumb a',
    'ol[class*="breadcrumb"] a',
    '.chakra-breadcrumb__list-item a',
  ];
  const crumbs: string[] = [];
  for (const link of root.querySelectorAll<HTMLElement>(selectors.join(','))) {
    // Tesco "Back to <category>" links are navigation, not a crumb.
    let text = link.textContent?.trim().replace(/^back\s+to\s+/i, '');
    // Sainsbury's breadcrumb links duplicate their own label (visible + a11y copy).
    if (
      text &&
      text.length % 2 === 0 &&
      text.slice(0, text.length / 2) === text.slice(text.length / 2)
    ) {
      text = text.slice(0, text.length / 2);
    }
    if (text) crumbs.push(text);
  }
  return crumbs;
}

function extractBrand(root: ParentNode): string | null {
  const el = root.querySelector<HTMLElement>(
    '[itemprop="brand"], [data-auto*="brand" i], [data-testid*="brand" i], .product-brand, [class*="product-brand"]'
  );
  const text = el?.textContent?.trim() || el?.getAttribute('content');
  return text || null;
}

const STORAGE_PATTERN =
  /refrigerat|keep chilled|microwave from chilled|keep cool|serve chilled|store in a cool dry|cool dry|do not freeze|do not refreeze|suitable for (home )?freez|keep frozen|store frozen|ambient|store cupboard|no refrigeration|use by|eat within|-18/i;

function extractStorageSentence(text: string): string | null {
  // Sainsbury's glues the section label onto the sentence ("StorageTo Keep…").
  const cleaned = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(storage|preparation)(?=[A-Z]|:|\s)/i, '');
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

function extractStorageText(selectors: string[], root: ParentNode): string | null {
  for (const el of root.querySelectorAll<HTMLElement>(selectors.join(','))) {
    const hit = el.textContent ? extractStorageSentence(el.textContent) : null;
    if (hit) return hit;
  }

  const excludeSel =
    '[class*="carousel"], [class*="cross-sell"], [class*="crosssell"], [class*="related"], [class*="recommend"], [class*="recently"], [class*="header"], [class*="footer"], [class*="nav"]';
  const candidates = root.querySelectorAll<HTMLElement>('p, li, td, dd, span, div');
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

const DEAL_SELECTORS = [
  '[class*="offer"]',
  '[class*="promotion"]',
  '[class*="multibuy"]',
  '[class*="multi-buy"]',
  '[class*="deal"]',
  '[class*="caption-module"]',
  '[class*="captionNectar"]',
  '[data-testid*="offer"]',
  '[data-testid*="promotion"]',
  '[data-testid*="multi"]',
  '[data-locator*="offer"]',
  'a[data-locator]',
  'p',
  'span',
  'div',
];

// Second branch requires £: bare "for 4" (freshness copy: "Typically fresh
// for 4 days") must never qualify. Multibuy without £ stays covered by
// the first branch (\d+ for \d+: "3 for 2", "3 for the price of 2"). Third
// branch: ASDA "Buy 6 Save 25%" has no "for". Bare "Save 25%" is a loyalty
// discount (Clubcard / Nectar / More Card), never a multibuy.
const DEAL_PATTERN =
  /(\d+\s*for\s*(?:the\s+price\s+of\s*)?£?\s*\d+\.?\d*|for\s+£\s*\d+\.?\d*|buy\s+\d+\b[^.]{0,20}?save\s+\d+%)/i;
const FRESHNESS_RE =
  /typically|fresh\s+for|use\s+within|eat\s+within|keep\s+(chilled|refrigerated|frozen)|best\s+before/i;

function extractDealText(root: ParentNode, extraExclude: string[]): string | null {
  const excludeSel = [EXCLUDE_SEL, ...extraExclude].join(', ');
  const priceEl = root.querySelector<HTMLElement>(DEFAULT_DEAL_ANCHOR.join(', '));
  const priceRect = priceEl?.getBoundingClientRect();

  let best: { text: string; el: HTMLElement } | null = null;
  for (const el of root.querySelectorAll<HTMLElement>(DEAL_SELECTORS.join(','))) {
    if (el.closest(excludeSel)) continue;
    const text = el.textContent?.trim() || '';
    if (text.length === 0 || text.length > 120) continue;
    if (FRESHNESS_RE.test(text)) continue;
    if (!DEAL_PATTERN.test(text)) continue;

    const isCaption =
      el.classList.contains('caption-module') || el.closest('[class*="caption-module"]') != null;
    const rect = el.getBoundingClientRect();
    if (priceRect && !isCaption) {
      const overlap = rect.left < priceRect.right && rect.right > priceRect.left;
      const centerY = (rect.top + rect.bottom) / 2;
      const inBand = centerY > priceRect.top - 200 && centerY < priceRect.bottom + 250;
      if (!overlap || !inBand) continue;
    }
    if (!best || text.length < best.text.length) best = { text, el };
  }
  if (!best) return null;
  markTrace('deal', matchedSelector(best.el, DEAL_SELECTORS));
  return best.text;
}

// Trusted store deal cards are self-qualifying like alert banners: matched only
// on the store's own selector, without the price-band proximity check, and long
// card text collapses to the matched deal phrase.
function extractStoreDeal(selectors: string[], root: ParentNode): string | null {
  for (const el of root.querySelectorAll<HTMLElement>(selectors.join(','))) {
    if (isExcluded(el)) continue;
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length === 0 || text.length > 300) continue;
    if (FRESHNESS_RE.test(text)) continue;
    const match = text.match(DEAL_PATTERN);
    if (!match) continue;
    markTrace('deal', matchedSelector(el, selectors));
    return match[0].trim();
  }
  return null;
}

function cleanDealText(deal: string | null): string | null {
  if (!deal) return null;
  return (
    deal
      // ASDA "New" chip sits in the same node as the offer link.
      .replace(/^new(?:[\s\-–—:]+)?(?=\s*(?:any|buy|only|save|£|\d))/i, '')
      .replace(/\s*-\s*Selected\s+[^-]+$/i, '')
      .replace(/\s*-\s*Cheapest\s+Product\s+Free/i, '')
      .trim() || null
  );
}

function normalizeType(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function extractFromJsonLd(): JsonLdResult | null {
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
        const brand =
          typeof node['brand'] === 'string' ? node['brand'] : node['brand']?.name || null;
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

function mergeFields(cfg: StoreConfig): MergedFields {
  const join = (store: string[] | undefined, defaults: readonly string[]): string[] => [
    ...new Set([...(store ?? []), ...defaults]),
  ];
  return {
    title: join(cfg.title, DEFAULT_FIELDS.title),
    image: join(cfg.image, DEFAULT_FIELDS.image),
    price: join(cfg.price, DEFAULT_FIELDS.price),
    was: join(cfg.was, DEFAULT_FIELDS.was),
    loyaltyPrice: join(cfg.loyaltyPrice, DEFAULT_FIELDS.loyaltyPrice),
    storage: join(cfg.storage, DEFAULT_FIELDS.storage),
  };
}

// ── ASDA: rollback pricing ────────────────────────────────────────────────────

// Labelled price paragraphs inside [data-testid="txt-pdp-product-price"].
function getLabeledPrice(
  field: string,
  label: string,
  container: string | undefined,
  root: ParentNode
): string | null {
  if (!container) return null;
  const containers = root.querySelectorAll<HTMLElement>(container);
  for (const el of containers) {
    if (isExcluded(el)) continue;
    for (const p of el.querySelectorAll<HTMLElement>('p')) {
      const span = p.querySelector<HTMLElement>('span');
      if (span?.textContent?.trim().toLowerCase() !== label) continue;
      const text = p.textContent?.trim();
      if (text) {
        markTrace(field, `${container} (${label})`);
        return text;
      }
    }
  }
  return null;
}

// ASDA labels "was £4.20 / actual price £4.00". Rollback is a plain store
// offer, not a loyalty scheme: regular price is the "was" figure, Rollback
// price is the offer figure, no was_price. Regular items (actual only) fall
// through untouched.
function applyAsdaRollback(values: PriceValues): void {
  if (values.was == null || values.price == null) return;
  values.offer = values.price;
  values.price = values.was;
  values.was = null;
}

// ── Morrisons: More Card promo ───────────────────────────────────────────────

// Promo price-container: promoted span + strikethrough original
// (data-test="bop-price-original"). Two numbers = More Card offer:
// original as regular price, promoted as More Card loyalty price.
// Single number = regular price capture (this markup misses all
// class-based price selectors).
function applyMorrisonsPromo(cfg: StoreConfig, scope: ParentNode, values: PriceValues): void {
  if (!cfg.priceContainer || !cfg.promoSelector) return;
  let handled = false;
  for (const container of scope.querySelectorAll<HTMLElement>(cfg.priceContainer)) {
    if (isExcluded(container)) continue;
    const numbers: { el: HTMLElement; value: number }[] = [];
    for (const span of container.querySelectorAll<HTMLElement>('span')) {
      const text = span.textContent?.trim() || '';
      const match = text.match(/£\s*(\d+\.?\d*)/);
      if (match) numbers.push({ el: span, value: parseFloat(match[1]) });
    }
    if (numbers.length === 1) {
      values.price = numbers[0].value;
      markTrace('price', `${cfg.priceContainer} (single)`);
      continue;
    }
    if (numbers.length !== 2) continue;

    // Markup order is promoted first, original second; data-test marks the
    // original when present. Promoted stays the first number either way.
    const original =
      numbers.find((n) => n.el.getAttribute('data-test') === 'bop-price-original') ?? numbers[1];
    const promoted = numbers[0];
    if (!original || !promoted) continue;
    if (original.value === promoted.value) continue;
    values.price = original.value;
    values.loyalty = promoted.value;
    values.was = null;
    handled = true;
    markTrace('price', `${cfg.priceContainer} (original)`);
    markTrace('loyalty', `${cfg.priceContainer} (promoted)`);
    break;
  }

  if (!handled) {
    for (const el of scope.querySelectorAll<HTMLElement>(cfg.promoSelector)) {
      if (isExcluded(el)) continue;
      const match = (el.textContent || '').match(/Now\s*£([\d.]+),?\s*Was\s*£([\d.]+)/i);
      if (!match) continue;
      values.price = parseFloat(match[2]);
      values.loyalty = parseFloat(match[1]);
      values.was = null;
      markTrace('price', `${cfg.promoSelector} (Now/Was)`);
      markTrace('loyalty', `${cfg.promoSelector} (Now/Was)`);
      break;
    }
  }

  // Promotions-window card: "£3.00 - More Card Price" (h3 or promo text).
  // Loyalty only when container/Now-Was paths did not set it. First £ wins:
  // unit price "£13.64/kg" sits after "More Card Price", never matches.
  if (values.loyalty == null) {
    const cardPattern = /£\s*(\d+\.?\d*)\s*[-–—]?\s*More\s*Card\s*Price/i;
    for (const el of scope.querySelectorAll<HTMLElement>(
      `h3${cfg.promoSelector}, ${cfg.promoSelector}`
    )) {
      if (isExcluded(el)) continue;
      const text = el.textContent?.trim() || '';
      if (text.length === 0 || text.length > 120) continue;
      const match = text.match(cardPattern);
      if (match) {
        values.loyalty = parseFloat(match[1]);
        markTrace('loyalty', `${cfg.promoSelector} (card)`);
        break;
      }
    }
  }
}

// ── Sainsbury's: offer alert ─────────────────────────────────────────────────

// Sainsbury's puts multibuy and expiry in one info alert: "Buy 3 get cheapest
// 1 free with Nectar available for delivery or collection until Tue, 17 Nov 2026."
const ALERT_DEAL_RE = /\d+\s*for\s*£?\s*\d+\.?\d*|buy\s+\d+\s+get\s+.+?\bfree\b/i;
const ALERT_REQUIRE_RE = /nectar|offer|price|save/i;

function extractAlert(
  selectors: string[],
  scopes: ParentNode[]
): { deal: string | null; expiry: string | null } | null {
  for (const scope of scopes) {
    for (const el of scope.querySelectorAll<HTMLElement>(selectors.join(','))) {
      if (isExcluded(el) || !el.textContent) continue;
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      if (text.length === 0 || text.length > 500) continue;
      // Site-wide alerts (cookies, baskets) carry dates too. Only offer banners qualify.
      if (!ALERT_REQUIRE_RE.test(text)) continue;
      const date = text.match(/\d{1,2}\s+\w+\s+\d{4}/);
      const deal = text.match(ALERT_DEAL_RE);
      if (!date && !deal) continue;
      const selector = matchedSelector(el, selectors);
      if (deal) markTrace('deal', selector);
      if (date) markTrace('expiry', selector);
      return { deal: deal ? deal[0].trim() : null, expiry: date ? toISODate(date[0]) : null };
    }
  }
  return null;
}

// ── Global: extraction pipeline + public API ────────────────────────────────

// Mode blocks are store-scoped post-processing; everything else in the
// pipeline is store-agnostic.
function applyMode(cfg: StoreConfig, scope: ParentNode, values: PriceValues): void {
  if (cfg.mode === 'asda-rollback') applyAsdaRollback(values);
  if (cfg.mode === 'morrisons-promo') applyMorrisonsPromo(cfg, scope, values);
}

function extractFromDom(cfg: StoreConfig, root: ParentNode, fields: MergedFields): DomResult {
  // Price signals come from hero only. Title / image may live outside buy-box.
  const priceScope = getHeroRoot(cfg);
  const scopes = priceScope === root ? [root] : [priceScope, root];
  const extraExclude = cfg.exclude ?? [];

  const alert = cfg.alert ? extractAlert(cfg.alert, scopes) : null;
  const dealText =
    alert?.deal ||
    (cfg.deal ? extractStoreDeal(cfg.deal, root) : null) ||
    extractDealText(priceScope, extraExclude) ||
    extractDealText(root, extraExclude);
  const deal = cleanDealText(dealText);

  const priceText =
    getPriceText(fields.price, priceScope, dealText) ||
    getLabeledPrice('price', 'actual price', cfg.priceContainer, priceScope) ||
    getLabeledPrice('price', 'was', cfg.priceContainer, priceScope);
  const wasPriceText =
    getLabeledPrice('was', 'was', cfg.priceContainer, priceScope) ||
    getText('was', fields.was, priceScope);
  const loyaltyPriceText = cfg.loyalty
    ? getText('loyalty', fields.loyaltyPrice, priceScope) || getLoyaltyPriceByPattern(priceScope)
    : null;
  // Plain "Offer" price only when no loyalty scheme matched.
  const offerPriceText =
    !loyaltyPriceText && cfg.offerPrice ? getText('offer', cfg.offerPrice, priceScope) : null;

  const imageUrl =
    getAttr('image', cfg.imageNoExclude ?? [], 'src', root, true) ||
    getAttr('image', fields.image, 'src', root);
  const title = getText('title', fields.title, root);

  const values: PriceValues = {
    price: parsePrice(priceText),
    was: parsePrice(wasPriceText),
    loyalty: parsePrice(loyaltyPriceText),
    offer: parsePrice(offerPriceText),
  };

  applyMode(cfg, priceScope, values);

  // Loyalty duplicating the regular price is a false positive. Null it.
  if (values.loyalty != null && values.loyalty === values.price) {
    values.loyalty = null;
    clearTrace('loyalty');
  }
  if (values.offer != null && values.offer === values.price) {
    values.offer = null;
    clearTrace('offer');
  }
  // Same for a was price equal to the current price: plain-offer containers
  // (Sainsbury's contextual price) echo the current price when not on offer.
  if (values.was != null && values.was === values.price) values.was = null;
  // Loyalty offers echo the loyalty figure in the was container
  // (Sainsbury's contextual price); a strikethrough never equals loyalty.
  if (values.was != null && (values.was === values.loyalty || values.was === values.offer)) {
    values.was = null;
    clearTrace('was');
  }

  const hasOfferSignal =
    values.was != null || values.loyalty != null || values.offer != null || deal != null;
  const offerExpiresAt =
    (cfg.expiry ? resolveExpiry(cfg.expiry, scopes, hasOfferSignal) : null) ||
    alert?.expiry ||
    resolveExpiry(DEFAULT_EXPIRY, scopes, hasOfferSignal);

  return {
    name: title,
    price: values.price,
    was_price: values.was,
    loyalty_price: values.loyalty,
    offer_price: values.offer,
    offer_type: values.loyalty != null ? 'loyalty' : values.offer != null ? 'offer' : null,
    offer_deal: deal,
    offer_expires_at: offerExpiresAt,
    image_url: imageUrl,
    product_url: window.location.href,
  };
}

interface RunResult {
  store: StoreConfig;
  product: ExtractedProduct;
  trace: Trace | null;
}

function runExtraction(traceEnabled: boolean): RunResult | null {
  const store = detectStoreByHost(window.location.hostname);
  if (!store) return null;
  if (traceEnabled) startTrace();

  const jsonLd = extractFromJsonLd();
  const root = getProductRoot();
  const fields = mergeFields(store);
  const dom = extractFromDom(store, root, fields);

  // Worker owns taxonomy. Client sends null guess plus signals.
  const category: string | null = null;

  const name = dom.name || jsonLd?.name || null;
  const crumbs = getBreadcrumbCrumbs(root);
  const category_signals = {
    breadcrumb_raw: crumbs,
    breadcrumb_leaf: crumbs.length > 0 ? crumbs[crumbs.length - 1] : null,
    title: name,
    brand: jsonLd?.brand || extractBrand(root) || null,
    store_id: store.id,
    url_path: window.location.pathname,
    jsonld_category: jsonLd?.category || null,
    storage_text: extractStorageText(fields.storage, root),
  };

  // JSON-LD priceValidUntil only counts when DOM shows an offer.
  // Stops stale / template expiry leaking onto regular items.
  const domHasOffer =
    dom.was_price != null ||
    dom.loyalty_price != null ||
    dom.offer_price != null ||
    dom.offer_deal != null;
  const offerExpiresAt = dom.offer_expires_at ?? (domHasOffer ? jsonLd?.offer_expires_at ?? null : null);

  const product: ExtractedProduct = {
    name,
    price: dom.price ?? jsonLd?.price ?? null,
    loyalty_price: dom.loyalty_price ?? null,
    offer_price: dom.offer_price ?? null,
    offer_type: dom.offer_type,
    was_price: dom.was_price ?? null,
    offer_deal: dom.offer_deal ?? null,
    offer_expires_at: offerExpiresAt,
    image_url: jsonLd?.image_url ?? dom.image_url ?? null,
    product_url: jsonLd?.product_url || dom.product_url,
    category,
    store: store.name,
    store_logo: store.logo,
    unit: null,
    currency: 'GBP',
    category_signals,
  };

  return { store, product, trace: traceEnabled ? stopTrace() : null };
}

// Composite product-page signal: JSON-LD Product node OR extracted
// name + price. Drives overlay button visibility on store pages.
export function hasProductPageSignal(): boolean {
  const store = detectStoreByHost(window.location.hostname);
  if (!store) return false;
  if (extractFromJsonLd() != null) return true;
  const dom = extractFromDom(store, getProductRoot(), mergeFields(store));
  return dom.name != null && dom.price != null;
}

export function extractProduct(): ExtractedProduct | null {
  const result = runExtraction(isDebugEnabled());
  if (result?.trace) {
    console.log(formatProductDump(result.product, result.trace, result.store.id));
  }
  return result?.product ?? null;
}

// __siftDump(): always traced, never auto-printed twice from extractProduct.
export function dumpProduct(): string {
  const result = runExtraction(true);
  if (!result) return 'SIFT: not a supported store page';
  return formatProductDump(result.product, result.trace ?? {}, result.store.id);
}
