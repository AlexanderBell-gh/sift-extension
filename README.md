# Sift Extension

Chrome MV3 browser extension for [Sift](https://siftsearch.pages.dev) — UK supermarket offer tracker. Extracts product data from store pages and adds to your Sift watchlist.

## Install

1. Download the [latest release](https://github.com/Alex-Projects-Master/sift-extension/releases) (`.zip`)
2. Unzip to a folder
3. Open `chrome://extensions`
4. Enable **Developer Mode** (top right)
5. Click **Load unpacked** → select the folder

## Usage

Browse to any supported store → click the extension icon → review product data → **Add to Watchlist**.

Captured per product: single price, loyalty price (Clubcard/Nectar/Rollback/etc.), previous ("was") price, offer expiry, category, and deal terms (multi-buy "Any 3 for £12"). Deals show as an orange pill; multi-buy items show the single price with the deal pill instead of a per-unit loyalty line.

## Supported Stores

| Store | Extraction | Notes |
|-------|-----------|-------|
| Tesco | Full | Clubcard price |
| Sainsbury's | Full | Nectar price |
| ASDA | Full | Rollback promotions (no expiry — counted as on-offer via rollback price) |
| Morrisons | Partial | More Card price |
| M&S | Partial | — |
| Aldi | Partial | — |
| Lidl | Partial | — |
| Co-op | Partial | Member price |
| Waitrose | Partial | My Waitrose price |
| Iceland | Partial | — |
| Ocado | Partial | — |

## Category Mapping

Raw breadcrumb text from store pages is normalized into target categories:

| Category | Keyword matches |
|----------|----------------|
| Chilled | yogurt, milk, cheese, cream, dairy, eggs |
| Snacks | crisps, nuts, bars, chocolate, biscuits |
| Beverages | drinks, juice, tea, coffee, beer, wine |
| Produce | fruit, vegetables, salad, lettuce |
| Frozen | frozen, ice cream |
| Bakery | bread, cakes, pastries, doughnuts |
| Food Cupboard | pasta, rice, tins, sauces, cereal |
| Other | unmatched fallback |

See `src/lib/category-map.ts` for full keyword lists and exact-match overrides.

## Development

```bash
pnpm install
pnpm run dev    # watch mode
pnpm run build  # production build
pnpm run zip    # package for distribution
```

Output: `.output/chrome-mv3/`

## Permissions

- `activeTab` — access current tab's product data
- `storage` — persist login token
- `tabs` — query for siftsearch.pages.dev tabs to link website session
- `scripting` — force-inject presence signal into existing tabs on install
- Host permissions for 11 store domains + Sift API + siftsearch.pages.dev + localhost:5173

## Auth

- **Login:** username + password via Sift API
- **Link account:** "Click here for Trial Users" button reads token from a logged in trial user in siftsearch.pages.dev's localStorage via content script
- **Token stored** in `chrome.storage.local` as `sift_token`

## Trial Users

Trial accounts are limited to **5 watchlist items**. When full, the extension shows a blocked screen with a link to manage items on your Watchlist page.
