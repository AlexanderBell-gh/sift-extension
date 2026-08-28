# Sift Extension

Chrome MV3 browser extension for [Sift](https://siftsearch.pages.dev) — UK supermarket offer tracker. Extracts product data from store pages and adds to your Sift watchlist.

## Install

1. Download the [latest release](https://github.com/Alex-Projects-Master/sift-extension/releases) (`.zip`)
2. Unzip to a folder
3. Open `chrome://extensions`
4. Enable **Developer Mode** (top right)
5. Click **Load unpacked** → select the folder

## Usage

Browse to any supported store → click the floating Sift icon (bottom-left) → view extracted product data in the overlay → **Add to Watchlist**.

Also works via the extension popup: click the extension icon → review product data → **Add to Watchlist**.

Captured per product: single price, loyalty price (Clubcard/Nectar/Rollback/etc.), previous ("was") price, offer expiry, category, and deal terms (multi-buy "Any 3 for £12", meal deals "Meal Deal for £15.00 with Nectar"). Long deal text is cleaned at source (strips `- Selected ...` and `- Cheapest Product Free` suffixes). Deals show as a pill with CSS truncation and full-text tooltip, and the loyalty line tints to the store brand color for Sainsbury's, Tesco, ASDA, Morrisons, and M&S (orange default for other stores); when a deal term is present, items show the single price with the deal pill instead of a per-unit loyalty line.

## Supported Stores

| Store | Extraction | Notes |
|-------|-----------|-------|
| Tesco | Full | Clubcard price |
| Sainsbury's | Full | Nectar price |
| ASDA | Full | Rollback promotions (no expiry — counted as on-offer via rollback price) |
| Morrisons | Full | More Card price; on-offer items show "Now £X, Was £Y" as More Card + regular price |
| M&S | Partial | Price + image extraction; deal badge color #242230 |
| Aldi | Partial | — |
| Lidl | Partial | — |
| Co-op | Partial | Member price |
| Waitrose | Partial | My Waitrose price |
| Iceland | Partial | — |
| Ocado | Partial | — |

## Category Mapping

Products are auto-categorised into `Chilled, Snacks, Beverages, Produce, Frozen, Bakery, Food Cupboard` (or `Other`) from the product title via keyword scoring, with breadcrumb/JSON-LD fallback. Short keywords match exact title tokens (substring only for 4+ char keywords); multi-word keywords (`peanut butter`, `ice cream`, `ready meal`) match as whole phrases and outweight single-word hits. Personal-care items (hand wash, body lotion) are force-routed to `Other`. See `src/lib/category-map.ts` for the rules and full keyword lists, and `CONTEXT.md` for how titles resolve.

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
- **Link account:** "24hr Trial Login" button reads token from a logged in trial user in siftsearch.pages.dev's localStorage via content script
- **Token stored** in `chrome.storage.local` as `sift_token`

## Trial Users

Trial accounts are limited to **5 watchlist items**. When full, the extension shows a blocked screen with a link to manage items on your Watchlist page.
