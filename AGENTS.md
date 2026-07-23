# AGENTS.md

## Project Overview

Chrome MV3 browser extension for [Sift](https://siftsearch.pages.dev) — UK supermarket price tracker. Extracts product data from store pages and adds to your Sift watchlist.

## Commands

```bash
pnpm install
pnpm run dev
pnpm run build
pnpm run zip
```

No lint, test, typecheck, or formatter commands exist.

## Architecture

- **Framework**: WXT (web extension toolkit)
- **Language**: TypeScript, strict mode
- **Package manager**: pnpm

### Key Files

- `entrypoints/background.ts` — Service worker. `chrome.runtime.onInstalled` → force-injects presence signal into existing siftsearch.pages.dev tabs.
- `entrypoints/content.ts` — Content script injected into 13 domains (11 stores + siftsearch.pages.dev + localhost:5173). Handles `extract` and `getToken` messages. Signals presence via meta tag + postMessage + CustomEvent.
- `entrypoints/popup/popup.ts` — Popup UI. Login with "Link Sift Account" button, product display, "Add to Watchlist".
- `src/lib/extract.ts` — Product extraction. DOM selectors + JSON-LD fallback. `toISODate()` for dates, `parsePrice()` with pence support.
- `src/lib/sift-api.ts` — API client. Auth, trial linking, watchlist additions (`watchlist_limit` detection).
- `wxt.config.ts` — Manifest (permissions: `activeTab`, `storage`, `tabs`, `scripting`; host_permissions: 11 stores + API + siftsearch.pages.dev + localhost:5173).
- `src/types.ts` — `ExtractedProduct` type.

### Store Detection

`src/lib/extract.ts:detectStore()` maps hostname to store ID. Adding a store requires updating `detectStore()`, `host_permissions`, `matches`, and loyalty label maps. `siftsearch.pages.dev` in matches/host_permissions is for session linking (not a store).

### Extraction Strategy

JSON-LD + DOM merge, DOM priority. Scoped to `<main>` via `getProductRoot()`. Store-specific selectors for prices, expiry, category. Dates normalized to ISO via `toISODate()`. Pence notation (`95p` → `0.95`) in `parsePrice()`.

## Development Notes

- Output: `.output/chrome-mv3/`. Load unpacked via `chrome://extensions` → Developer mode.
- Token stored in `chrome.storage.local` as `sift_token`. API URL hardcoded in `sift-api.ts`.
- `sharp` is a devDependency (icon processing).
- Log changes in CHANGES.md (see `/home/wsl/Projects/markdowns/Sift Project/Extension/CHANGES.md`).
- Full context: `/home/wsl/Projects/markdowns/Sift Project/Extension/CONTEXT.md`
- Design tokens: `/home/wsl/Projects/markdowns/Sift Project/DESIGN.md`
