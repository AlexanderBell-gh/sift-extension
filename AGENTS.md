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

- `entrypoints/content.ts` — Content script injected into supported supermarket sites. Listens for messages to extract product data.
- `entrypoints/popup/popup.ts` — Popup UI. Handles login, product display, and "Add to Watchlist" action.
- `src/lib/extract.ts` — Product extraction logic. Uses DOM selectors with JSON-LD fallback for each supported store.
- `src/lib/sift-api.ts` — API client for Sift backend (`siftapi.blackmesa.workers.dev`). Handles auth and watchlist additions.
- `wxt.config.ts` — Extension manifest configuration (permissions, icons, popup).
- `src/types.ts` — `ExtractedProduct` type definition.

### Store Detection

`src/lib/extract.ts:detectStore()` maps hostname to store ID. Adding a new store requires updating:
1. `detectStore()` in `src/lib/extract.ts`
2. `host_permissions` in `wxt.config.ts`
3. `matches` in `entrypoints/content.ts`
4. Loyalty label maps in `entrypoints/popup/popup.ts` and `src/lib/sift-api.ts`

### Extraction Strategy

Product extraction runs both JSON-LD (`extractFromJsonLd()`) and DOM (`extractFromDom()`), merging results with DOM priority. DOM queries scoped to `<main>`/primary content container via `getProductRoot()` to avoid cross-product contamination.

**Fields:**
- `category` — extracted from DOM breadcrumbs last link, normalized via `CATEGORY_MAP`. Also from JSON-LD `category` field.
- `offer_expires_at` — direct selectors per store (`.expiry-date` Sainsbury's, `.ddsweb-value-bar__terms` Tesco), broad sweep with `until DD/MM/YYYY` priority. Also from JSON-LD `priceValidUntil`.

DOM selectors are store-specific and fragile — they break when stores redesign their pages.

## Development Notes

- Output directory: `.output/chrome-mv3/`
- Load unpacked extension via `chrome://extensions` → Developer Mode → Load unpacked
- API token stored in `chrome.storage.local` as `sift_token`
- No environment variables — API URL is hardcoded in `src/lib/sift-api.ts`
- `sharp` is a devDependency (likely for icon processing during build)
- CHANGES.md: log every change with file + line numbers (see /home/wsl/Projects/markdowns/Sift Project/Extension/CHANGES.md)

### Markdowns

- `/home/wsl/Projects/markdowns/Sift Project/Extension/CONTEXT.md` — full architecture, API ref, data model, critical flows
- `/home/wsl/Projects/markdowns/Sift Project/Extension/CHANGES.md` — change log convention
- `/home/wsl/Projects/markdowns/Sift Project/DESIGN.md` — design system spec