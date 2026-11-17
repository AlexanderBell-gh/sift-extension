<p align="center">
  <img src="./public/icon128.png" width="96" alt="Sift Extension icon" />
</p>

<h1 align="center">Sift Extension</h1>

<p align="center"><strong>Chrome MV3 extension for Sift — UK grocery tracker.</strong></p>

<p align="center">
  <a href="https://siftuk.pages.dev"><strong>Sift</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-3-F26522?logo=google-chrome&logoColor=white" alt="Chrome MV3" />
  <img src="https://img.shields.io/badge/License-MIT-16A34A" alt="MIT license" />
  <img src="https://img.shields.io/badge/pnpm-12-F69220?logo=pnpm&logoColor=white" alt="pnpm 12" />
</p>

<!-- Screenshots (pending real captures): Overlay on product page, Settings popup -->

Extracts product data from store pages and adds to your Sift watchlist. The extension only appears on product pages (detected via JSON‑LD Product data or name + price); it stays hidden on home, category, and search pages. Click the floating icon to view extracted fields (regular price, loyalty price, offer price, previous "was" price, expiry, category, deal terms) and **Add to Watchlist**.

## Install

1. Download the [latest release](https://github.com/AlexanderBell-gh/sift-extension/releases) (`.zip`)
2. Unzip to a folder
3. Open `chrome://extensions`
4. Enable **Developer Mode** (top right)
5. Click **Load unpacked** → select the folder

## Usage

The overlay shows: regular price, loyalty price (Clubcard/Nectar/More Card/My Waitrose), plain offer price (including ASDA Rollback), previous "was" price, offer expiry, category, and deal terms (multi‑buy "Any 3 for £12", meal deals "Meal Deal for £15.00 with Nectar"). Long deal text is cleaned at source; the pill truncates with a full‑text tooltip. The second price line names which slot is set: loyalty items tint to the store brand colour and hide the was‑price; plain offers print an offer label in red; ASDA Rollback keeps its store colour.

**Popup:** click the extension icon → configure overlay position (Bottom Left/Right, Top Left/Right), open your Watchlist, or sign out.

## Supported Stores

| Store | Extraction | Notes |
|-------|-----------|-------|
| Tesco | Full | Clubcard price, multi‑buys |
| Sainsbury's | Full | Nectar price, multi‑buys |
| ASDA | Full | Rollback promotions, multi‑buys (no expiry — counted as on‑offer via rollback price) |
| Morrisons | Full | More Card price, multi‑buys |
| M&S | Full | Multi‑buy offers (no expiry) |
| Aldi | Partial | — |
| Lidl | Partial | — |
| Waitrose | Partial | My Waitrose price |
| Iceland | Partial | — |

## Category Mapping

The extension does **not** guess categories. The Sift worker (`workers/lib/category.js`, `TAXONOMY_VERSION = 3` in the main repo) is the single source of truth for watchlist taxonomy. Every add sends `category: null` plus raw `category_signals` (breadcrumb trail, title, brand, store id, URL path, JSON‑LD category, storage instructions) — scored server‑side. Client‑side keyword guessing was removed in v0.3.0; all taxonomy changes happen worker‑side.

## Development

```bash
pnpm install
pnpm run dev    # watch mode
pnpm run build  # production build
pnpm run zip    # package for distribution
pnpm run check  # store registry asserts (node scripts/check-config.ts)
```

Output lives in `.output/chrome-mv3/`.

### Debugging extraction

Open DevTools on a store page → console context **Sift** → `__siftDump()`. It prints every extracted field plus the selector that matched. Add `?sift_debug=1` to the URL, or set `localStorage.sift_debug = '1'`, to auto‑print the dump on each extraction. Selectors are in `src/lib/store-config.ts`; `pnpm run check` asserts the registry before you reload.

## Permissions

- `activeTab` — access current tab's product data
- `storage` — persist login token
- `tabs` — query for `siftsearch.pages.dev` tabs to link website session
- `scripting` — force‑inject presence signal into existing tabs on install
- Host permissions: 10 store domains + Sift API + `siftsearch.pages.dev` + `localhost:5173`

## Auth

- **Token sync:** sign in on `siftsearch.pages.dev`; the site hands the token to the extension, which stores it as `chrome.storage.local.sift_token`.
- **Popup fallback:** with no stored token, the popup asks an open Sift tab for `localStorage.auth_token` and shows a login prompt if none exists.
- **Sign out:** removes `sift_token`.

## Trial Users

Trial accounts are limited to **5 watchlist items**. When full, the extension shows a blocked screen with a link to manage items on your Watchlist page. Expired trials get their own blocked message; any other add failure now shows its error inline instead of silently resetting the button.
