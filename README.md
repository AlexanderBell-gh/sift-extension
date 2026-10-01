# Sift Extension

Chrome MV3 browser extension for [Sift](https://siftsearch.pages.dev) — UK supermarket offer tracker. Extracts product data from store pages and adds to your Sift watchlist.

## Install

1. Download the [latest release](https://github.com/Alex-Projects-Master/sift-extension/releases) (`.zip`)
2. Unzip to a folder
3. Open `chrome://extensions`
4. Enable **Developer Mode** (top right)
5. Click **Load unpacked** → select the folder

## Usage

Browse to any supported store → click the floating Sift icon → view extracted product data in the overlay → **Add to Watchlist**.

The button appears only on product pages (detected via JSON-LD Product data or name + price). On home, category, and search pages it stays hidden; if a click ever lands on a non-product page, the overlay shows a "No product detected on this page" message instead of an empty product.

The extension popup is a settings panel: click the extension icon → configure overlay position (Bottom Left, Bottom Right, Top Left, Top Right), open your Watchlist, or sign out.

Captured per product: single price, loyalty price (Clubcard/Nectar/Rollback/etc.), previous ("was") price, offer expiry, category, and deal terms (multi-buy "Any 3 for £12", meal deals "Meal Deal for £15.00 with Nectar"). Long deal text is cleaned at source (strips `- Selected ...` and `- Cheapest Product Free` suffixes). Deals show as a pill with CSS truncation and full-text tooltip, and the loyalty line tints to the store brand color for Sainsbury's, Tesco, ASDA, Morrisons, and M&S (orange default for other stores); when a deal term is present, items show the single price with the deal pill instead of a per-unit loyalty line.

## Supported Stores

| Store | Extraction | Notes |
|-------|-----------|-------|
| Tesco | Full | Clubcard price, multi-buys |
| Sainsbury's | Full | Nectar price, multi-buys |
| ASDA | Full | Rollback promotions, multi-buys (no expiry — counted as on-offer via rollback price) |
| Morrisons | Full | More Card price, multi-buys  |
| M&S | Full | Multi-buy offers (no expiry)  |
| Aldi | Partial | — |
| Lidl | Partial | — |
| Co-op | Partial | Member price |
| Waitrose | Partial | My Waitrose price |
| Iceland | Partial | — |
| Ocado | Partial | — |

## Category Mapping

The extension does not guess categories. The Sift worker (`workers/lib/category.js`, `TAXONOMY_VERSION = 3` in the main Sift repo) is the single source of truth for watchlist taxonomy. Every watchlist add sends `category: null` plus raw `category_signals` (breadcrumb trail, title, brand, store id, URL path, JSON-LD category, storage-instructions text), which the worker scores server-side. Client-side keyword guessing was removed in v0.3.0 (it mis-filed noisy breadcrumbs as Frozen); all taxonomy changes happen worker-side.

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
- **Token stored** in `chrome.storage.local` as `sift_token`

## Trial Users

Trial accounts are limited to **5 watchlist items**. When full, the extension shows a blocked screen with a link to manage items on your Watchlist page. Expired trials get their own blocked message, and any other add failure now shows its error inline instead of silently resetting the button.
