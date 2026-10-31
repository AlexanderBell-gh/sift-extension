// Store registry + selector data. Keep this file DOM-free and dependency-free:
// wxt.config.ts and entrypoints/content.ts import it at build time.
//
// Resolution: a store's own list is PREPENDED to the matching DEFAULT_FIELDS
// list and deduplicated. Selector order is load-bearing — store selectors run
// before generic ones, and reordering flips regular/offer prices on ASDA/Tesco.

export type StoreMode = 'standard' | 'asda-rollback' | 'morrisons-promo';

export interface HeroScore {
  loyalty: string;
  offer: string;
  price: string;
}

export interface ExpiryRule {
  selectors: string[];
  /** Tried in order per node; capture group 1 is the date. */
  patterns: RegExp[];
  /** Only accept nodes whose text matches this. */
  require?: RegExp;
  /** Only run when the product already shows an offer. */
  gate?: boolean;
}

export interface StoreConfig {
  id: string;
  name: string; // sent to the Worker and shown in the overlay
  logo: string;
  /** Suffix-matched: 'tesco.com' covers www.tesco.com and groceries.tesco.com. */
  hosts: string[];
  /** Manifest + content-script matches. */
  matches: string[];
  loyalty?: string;
  mode?: StoreMode;
  /** Hero price container candidates, scored so the offer block wins over price-only copies. */
  hero?: { selectors: string[]; score: HeroScore };
  title?: string[];
  image?: string[];
  /** Gallery images sit inside wrappers the exclusion list drops; queried unscoped. */
  imageNoExclude?: string[];
  price?: string[];
  was?: string[];
  loyaltyPrice?: string[];
  storage?: string[];
  expiry?: ExpiryRule;
  /** Offer banner carrying multibuy + expiry in one node (Sainsbury's). */
  alert?: string[];
  /** Extra exclusion selectors on top of the shared carousel/cross-sell list. */
  exclude?: string[];
}

export const DEFAULT_FIELDS = {
  title: [
    'h1',
    '[data-auto="product-title"]',
    '[data-testid="product-tile-title"]',
    '[data-testid="txt-pdp-product-name"]',
  ],
  image: [
    'img.pd__image',
    'img[data-auto="product-image"]',
    '.product-image img',
    'img[src*="digitalcontent.api.tesco.com"]',
    '[data-testid="product-tile-image"] img',
    'img[data-testid="img"]',
  ],
  price: [
    '.ds-c-price__price[data-colour="subtle"]',
    '[data-testid="pd-retail-price"]',
    '.pd__cost__retail-price',
    '.pt__cost__retail-price',
    '[data-auto="price-per-quantity-weight"]',
    '.price-main__integer',
    '[data-testid="product-tile-price"]',
    '.product-price',
    '.online-components-product-tile-price__text',
  ],
  was: [
    '[data-auto="was-price"]',
    '.price--was',
    '.product-price--previous',
    '.pt__cost__retail-price--was',
    '[data-testid="was-price"]',
  ],
  loyaltyPrice: [
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
  ],
  storage: [
    '[class*="storage"]',
    '[class*="preparation"]',
    '[class*="cooking-instruction"]',
    '[data-testid*="storage"]',
    '[data-testid*="preparation"]',
    '[itemprop="storageInstructions"]',
  ],
} as const;

const DATE_SHORT = /\d{1,2}\s+\w+\s+\d{4}/;

export const DEFAULT_EXPIRY: ExpiryRule = {
  selectors: [
    '[class*="offer"]',
    '[class*="promotion"]',
    '[class*="expiry"]',
    '[class*="terms"]',
    '[data-testid*="offer"]',
    '[data-testid*="promotion"]',
  ],
  // Never bare p/span/div: Tesco carousel titles leaked dates onto regular items.
  patterns: [
    /until\s+(\d{2}\/\d{2}\/\d{4})/,
    new RegExp('until[\\s:]\\s*(?:[a-z]{3,9},\\s*)?(' + DATE_SHORT.source + ')', 'i'),
    new RegExp('expires?[\\s:]\\s*(?:[a-z]{3,9},\\s*)?(' + DATE_SHORT.source + ')', 'i'),
    new RegExp('valid until[\\s:]\\s*(?:[a-z]{3,9},\\s*)?(' + DATE_SHORT.source + ')', 'i'),
    new RegExp('ends?[\\s:]\\s*(?:[a-z]{3,9},\\s*)?(' + DATE_SHORT.source + ')', 'i'),
  ],
  gate: true,
};

const HERO_SCORE: HeroScore = {
  loyalty:
    '.ds-c-price__price[data-colour="nectar"], [data-auto="clubcard-price"], .price--clubcard, .clubcard-price, [data-testid="clubcard-price"], [data-testid="contextual-price-text"], .ddsweb-value-bar__content-text, .nectar-offer, [class*="nectar-price"], [data-testid*="nectar"], [class*="more-card"], [class*="member-price"], [class*="loyalty"]',
  offer:
    '.ddsweb-value-bar__terms, [class*="value-bar__terms"], [class*="termsText"], [class*="alert__message"], .ds-c-alert, .expiry-date, [class*="--promotion"]',
  price:
    '.ds-c-price__price[data-colour="subtle"], .online-components-product-tile-price__text, [data-testid="product-tile-price"], [data-testid="pd-retail-price"], [data-testid="txt-pdp-product-price"]',
};

export const STORE_CONFIG: Record<string, StoreConfig> = {
  tesco: {
    id: 'tesco',
    name: 'Tesco',
    logo: '/Tesco_Logo.svg',
    hosts: ['tesco.com'],
    matches: ['https://www.tesco.com/*'],
    loyalty: 'Clubcard',
    hero: {
      selectors: [
        // Title section first: stable across hashed renames, holds price +
        // promotion + terms together, excludes the sticky banner (sibling
        // outside the section) automatically. :has needs Chrome 105+.
        'section:has([data-auto="pdp-product-title"])',
        '[class*="clubcard-promotion"]',
        '[data-auto="pdp-buy-box-quantity-controls-container"]',
        '[data-auto="pdp-buy-box"]',
        '[data-auto="pdp-product-tile-messaging"]',
      ],
      score: HERO_SCORE,
    },
    title: ['h1', '[data-testid="product-tile-title"]', '[data-auto="product-title"]'],
    image: [
      'img[src*="digitalcontent.api.tesco.com"]',
      '[data-testid="product-tile-image"] img',
      'img[data-auto="product-image"]',
    ],
    loyaltyPrice: [
      '[data-auto="clubcard-price"]',
      '.price--clubcard',
      '.clubcard-price',
      '[data-testid="clubcard-price"]',
      '[data-testid="contextual-price-text"]',
      '.ddsweb-value-bar__content-text',
    ],
    was: ['[data-auto="was-price"]', '.product-price--previous', '[data-testid="was-price"]'],
    expiry: {
      // Trusted banner: only renders with a real offer, so no gate.
      selectors: ['.ddsweb-value-bar__terms', '[class*="value-bar__terms"]', '[class*="termsText"]'],
      patterns: [/until\s+(\d{2}\/\d{2}\/\d{4})/],
      require: /offer|clubcard|promotion/i,
    },
    storage: [
      '[class*="preparation"]',
      '[class*="storage"]',
      '[class*="cooking"]',
      '[data-testid*="preparation"]',
      '[data-testid*="storage"]',
      '[data-testid*="cooking"]',
      '[class*="product-info"]',
    ],
  },

  sainsburys: {
    id: 'sainsburys',
    name: "Sainsbury's",
    logo: "/Sainsbury's_Logo.svg",
    hosts: ['sainsburys.co.uk'],
    matches: ['https://www.sainsburys.co.uk/*'],
    loyalty: 'Nectar',
    hero: {
      selectors: [
        '[data-testid="pdp-meta-sticky"]',
        '[data-testid="gw-product-price-container"]',
        '[data-testid="gw-product-retail-price"]',
      ],
      score: HERO_SCORE,
    },
    title: ['h1', '[data-auto="product-title"]'],
    image: ['img.pd__image', 'img[data-auto="product-image"]', '.product-image img'],
    // Strict: Nectar badge only inside the hero price container.
    // .pd__cost--price removed: regular price container, not loyalty.
    loyaltyPrice: [
      '.ds-c-price__price[data-colour="nectar"]',
      '.nectar-offer',
      '[class*="nectar-price"]',
      '[data-testid*="nectar"]',
    ],
    was: [
      '[data-auto="was-price"]',
      '.price--was',
      '.product-price--previous',
      '.pt__cost__retail-price--was',
      '[data-testid="was-price"]',
    ],
    alert: ['[class*="alert__message"]', '[class*="alert-message"]', '.ds-c-alert'],
    expiry: {
      selectors: ['.expiry-date'],
      patterns: [/(\d{1,2}\s+\w+\s+\d{4})/],
    },
    storage: [
      '[class*="preparation"]',
      '[class*="storage"]',
      '[class*="cooking"]',
      '[data-auto*="preparation"]',
      '[data-auto*="storage"]',
      '[data-auto*="cooking"]',
      '.pd__preparation',
      '.pd__storage',
    ],
  },

  asda: {
    id: 'asda',
    name: 'ASDA',
    logo: '/ASDA_Logo.svg',
    hosts: ['asda.com'],
    matches: ['https://www.asda.com/groceries/*'],
    loyalty: 'Rollback',
    mode: 'asda-rollback',
    title: ['h1', '[data-testid="txt-pdp-product-name"]'],
    image: ['img[data-testid="img"]', '.product-image img', 'img[data-auto="product-image"]'],
    loyaltyPrice: [
      '[data-testid="contextual-price-text"]',
      '[class*="asda-price"]',
      '[data-testid*="asda-price"]',
      '[data-testid*="reduced"]',
      '[class*="price-lock"]',
      '[data-testid*="price-lock"]',
    ],
    was: ['[data-auto="was-price"]', '.price--was', '.product-price--previous', '[data-testid="was-price"]'],
  },

  morrisons: {
    id: 'morrisons',
    name: 'Morrisons',
    logo: '/Morrisons_Logo.svg',
    hosts: ['morrisons.com'],
    matches: ['https://groceries.morrisons.com/*'],
    loyalty: 'More Card',
    mode: 'morrisons-promo',
    title: ['h1', '[data-auto="product-title"]'],
    image: ['img[data-auto="product-image"]', '.product-image img'],
    loyaltyPrice: ['[class*="more-card"]', '[data-testid*="more-card"]'],
    // "You might also like" tiles repeat deal text next to the PDP price.
    exclude: ['[data-test*="you-might"]'],
    expiry: {
      selectors: ['[class*="--promotion"]'],
      patterns: [
        /(?:order\s*by|until|before|valid until)\s+(\d{2}\/\d{2}\/\d{4})/i,
        /(\d{2}\/\d{2}\/\d{4})/,
      ],
      require: /offer/i,
    },
  },

  marksandspencer: {
    id: 'marksandspencer',
    name: 'M&S',
    logo: '/M&S_Logo.svg',
    hosts: ['marksandspencer.com'],
    matches: ['https://www.marksandspencer.com/*'],
    title: ['h1'],
    // Gallery wrapper class contains "carousel" (image-grid-and-carousel) and
    // the exclusion list would drop it, so these are queried unscoped.
    imageNoExclude: [
      '[class*="image-gallery_isCurrent"] img',
      'img[data-tagg="gallery-image"]',
      '[class*="image-gallery_slide"] img',
    ],
    price: ['[class*="priceWrapper"]', '.price_priceWrapper__Yp_17'],
  },

  aldi: {
    id: 'aldi',
    name: 'Aldi',
    logo: '/Aldi_Logo.svg',
    hosts: ['aldi.co.uk'],
    matches: ['https://www.aldi.co.uk/*'],
  },

  lidl: {
    id: 'lidl',
    name: 'Lidl',
    logo: '/Lidl_Logo.svg',
    hosts: ['lidl.co.uk'],
    matches: ['https://www.lidl.co.uk/*'],
  },

  coop: {
    id: 'coop',
    name: 'Co-op',
    logo: '/Co-op_Logo.svg',
    hosts: ['coop.co.uk'],
    matches: ['https://www.coop.co.uk/*'],
    loyalty: 'Member',
  },

  waitrose: {
    id: 'waitrose',
    name: 'Waitrose',
    logo: '/Waitrose_Logo.svg',
    hosts: ['waitrose.com'],
    matches: ['https://www.waitrose.com/*'],
    loyalty: 'My Waitrose',
  },

  iceland: {
    id: 'iceland',
    name: 'Iceland',
    logo: '/Iceland_Logo.svg',
    hosts: ['iceland.co.uk'],
    matches: ['https://www.iceland.co.uk/*'],
  },
};

/** Sift site matches: session linking, not stores. */
export const SITE_MATCHES = ['https://siftsearch.pages.dev/*', 'http://localhost:5173/*'];

/** Host permissions outside the store list, used by wxt.config.ts. */
export const SITE_HOST_PERMISSIONS = ['https://siftapi.blackmesa.workers.dev/*', ...SITE_MATCHES];

export function detectStoreByHost(hostname: string): StoreConfig | null {
  const host = hostname.toLowerCase();
  for (const store of Object.values(STORE_CONFIG)) {
    if (store.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return store;
  }
  return null;
}

export function getStoreMatches(): string[] {
  return Object.values(STORE_CONFIG).flatMap((store) => store.matches);
}

export const LOYALTY_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(STORE_CONFIG).flatMap((store) => (store.loyalty ? [[store.name, store.loyalty]] : []))
);
