# SIFT_TODO.md — Website support for `offer_deal`

Extension now sends a new field `offer_deal` (multi-buy term, e.g. `"Any 3 for £12"`)
when adding products to the watchlist. The Sift website does NOT yet persist or
render it. This file lists every change needed in the website repo
(`/home/wsl/Projects/Sift`) so an LLM or developer can complete the feature.

## Background / semantics

- `offer_deal` is free text: `"Any 3 for £12"`, `"3 for 2"`, etc. No structured
  quantity/price parse is required.
- A product with only a multi-buy deal (no `loyalty_price`, no `was_price`, no
  expiry) now arrives with `is_on_offer = 1`. The website must therefore handle
  offers that have NO numeric discount pair — the single price in
  `prices.normal` is the only price, and the deal term is the offer signal.
- Extension already: sends `offer_deal` in `POST /api/watchlist` body, counts it
  in `is_on_offer`, renders an orange `.deal-badge` pill in the popup.

## 1. Database — `workers/schema.sql`

- `watchlist` table: add column `offer_deal TEXT` (nullable). Existing rows fine
  (null). Requires a migration / `ALTER TABLE` for existing D1 databases.

## 2. Worker — `workers/index.js`

- **Add-to-watchlist INSERT (~line 1194-1217):** add `offer_deal` column to the
  `INSERT INTO watchlist (...)` column list and bind `result.offer_deal || null`.
- **Row→JSON map (~line 256-259):** add `offer_deal: r.offer_deal,` to the mapped
  watchlist item object.
- **`/api/deal-offers` (~line 1067-1095):** add `offer_deal` to the `SELECT`
  column list and to the mapped response object.
- **`/api/watchlist` GET response (~line 1140-1147):** add `offer_deal` to the
  mapped row (uses same shape as the row map above).
- **Watchlist-name / autocomplete endpoints:** only need `product_name`, no change.
- Cron expiry job: no change (`offer_expires_at` still the only expiry signal;
  multi-buy has no expiry by design).

## 3. Frontend types — `src/types/index.ts`

- `SearchResult` (~line 24): add `offer_deal: string | null`.
- `WatchlistItem` (~line 45): add `offer_deal: string | null`.
- `DealOffer` lives in `src/lib/api.ts` (~line 88-103): add
  `offer_deal: string | null`.

## 4. API client — `src/lib/api.ts`

- `DealOffer` interface: add `offer_deal` (see above).
- `addToWatchlist` payload builder (if it constructs `result` from a passed
  object, ensure `offer_deal` is forwarded).

## 5. Deals of the Day — `src/components/DealSection.tsx`

- `DealCard` → `handleAddToWatchlist` builds a `SearchResult` (~line 23-36):
  add `offer_deal: deal.offer_deal`.
- `DealCard` render (~line 80-93): currently shows `full-price` (normal) and
  `deal-price` (loyalty) only when each is non-null. Add an `offer_deal` pill
  (match design tokens — primary `#FF5701`, white text, ~11px, rounded) shown
  when `offer_deal` is present, next to / below the price row. When only a deal
  exists (loyalty null), keep showing `full-price` + the deal pill.

## 6. Watchlist — `src/components/WatchlistPage.tsx`

- Best-price logic (~line 221): compare `normal` vs `loyalty`; an item whose only
  offer is a multi-buy deal has `loyalty = null` and still shows as on-offer via
  `is_on_offer`. Ensure that path doesn't crash and still renders the normal price.
- Offer line (~line 253-255): currently renders "Offer ends {date}" only when
  `offer_expires_at` set. Add a deal pill from `offer_deal` (independent of expiry).
- Any `WatchlistItem` → `SearchResult` conversions must forward `offer_deal`.

## 7. Export — `src/components/SettingsPage.tsx`

- CSV export (~line 282-283): add an `Offer Deal` column from `i.offer_deal ?? ''`.

## Verification

- `pnpm run build` (website) — typecheck includes the new fields.
- Add a multi-buy product via extension → confirm `offer_deal` stored in D1 and
  returned by `/api/watchlist` + `/api/deal-offers`.
- Confirm a multi-buy-only offer (no loyalty price) renders in Deals of the Day
  with normal price + deal pill.
