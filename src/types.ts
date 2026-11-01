export interface CategorySignals {
  breadcrumb_raw: string[];
  breadcrumb_leaf: string | null;
  title: string | null;
  brand: string | null;
  store_id: string;
  url_path: string;
  jsonld_category: string | null;
  storage_text: string | null;
}

export interface ExtractedProduct {
  name: string | null;
  price: number | null;
  /** Loyalty price, or a plain store "Offer" price (loyalty_label names which). */
  loyalty_price: number | null;
  /** Set when loyalty_price is a plain offer rather than the store's loyalty scheme. */
  loyalty_label?: string | null;
  was_price: number | null;
  offer_deal: string | null;
  category: string | null;
  offer_expires_at: string | null;
  image_url: string | null;
  product_url: string;
  store: string;
  store_logo: string;
  unit: string | null;
  currency: string;
  category_signals: CategorySignals | null;
}
