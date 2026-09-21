export interface CategorySignals {
  breadcrumb_raw: string[];
  breadcrumb_leaf: string | null;
  title: string | null;
  brand: string | null;
  store_id: string;
  url_path: string;
  jsonld_category: string | null;
}

export interface ExtractedProduct {
  name: string;
  price: number | null;
  loyalty_price: number | null;
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
