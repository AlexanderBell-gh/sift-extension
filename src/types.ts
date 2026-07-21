export interface ExtractedProduct {
  name: string;
  price: number | null;
  loyalty_price: number | null;
  was_price: number | null;
  offer_badge: string | null;
  offer_expires_at: string | null;
  image_url: string | null;
  product_url: string;
  store: string;
  store_logo: string;
  unit: string | null;
  currency: string;
}
