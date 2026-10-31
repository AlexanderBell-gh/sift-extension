# AGENTS.md

## Session rules

- **On startup skills**: `@caveman` at `full` intensity, all session, until told otherwise.
- **Prefix every shell command with:** `rtk` — e.g. `rtk git log -5`.
- **Prioritise implementation quality over code volume:** more code ≠ better code.
- **Only use these git commands**: `status`, `log`, `diff`, `diff --cached`, `show`, `blame`, `tag`. **Never use**: `commit`, `push`, `reset`, `rebase` or `amend`.

## CLI commands

```bash
rtk pnpm install
rtk pnpm run dev     # wxt dev — watch + HMR, writes .output/chrome-mv3/
rtk pnpm run build   # wxt build — production bundle
rtk pnpm run zip     # wxt zip — release artifact
rtk pnpm run check   # node scripts/check-config.ts — store registry asserts, no DOM
```

No lint, test, typecheck or formatter exists. `wxt build` transpiles without `tsc`, so type errors ship silently — read changed types by hand. Load: `chrome://extensions` → Developer mode → Load unpacked → `.output/chrome-mv3/`.

## Code style & conventions

- TypeScript, `strict`, ESNext, `moduleResolution: bundler`. `tsconfig.json` includes only `src/**/*.ts`; `entrypoints/` use WXT auto-imports (`defineContentScript`, `defineBackground`) — never import them by hand.
- No formatter: match surrounding code. Two spaces, single quotes, semicolons, named exports, comments explain why.
- Overlay styles import as `./overlay.css?inline` — a plain CSS import leaks into store pages.
- Store-specific behaviour branches on `mode` (`asda-rollback`, `morrisons-promo`) and on `storeId`, never on display name.
- **All selectors live in `src/lib/store-config.ts`** (`STORE_CONFIG` + `DEFAULT_FIELDS`). Overlay and popup never query store DOM; `extract.ts` is the generic engine and holds no selector literals.

## Architecture snapshot

WXT 0.21 + TypeScript 7 + pnpm → Chrome MV3. Backend is the Sift Worker (`siftapi.blackmesa.workers.dev`); site is `siftsearch.pages.dev` (main repo `/home/wsl/Repositories/Sift`).

`entrypoints/` `background.ts` (API proxy + install-time presence injection) · `content.ts` (matches from config, presence signal, `extract`/`getToken` messages, `__siftDump`, `initOverlay()`) · `popup/` (`index.html` shell + `popup.ts` settings: position, watchlist link, sign out) · `src/lib/` `store-config.ts` (store registry, selectors, derived `matches`/`LOYALTY_LABELS` — DOM-free because `wxt.config.ts` imports it), `extract.ts` (DOM + JSON-LD engine), `debug.ts` (extraction trace + `__siftDump` format), `overlay.ts` + `overlay.css` (floating button, Shadow DOM panel, add-to-watchlist), `sift-api.ts` (API client) · `public/` icons · `wxt.config.ts` (manifest: permissions, generated `host_permissions`, action) · `scripts/check-config.ts` (registry asserts).

- **Overlay gate**: button shows only when `hasProductPageSignal()` (JSON-LD `Product` OR DOM name + price); 5 retries for late-rendered SPAs; `MutationObserver` + `popstate` destroy the overlay and re-check on URL change.
- **Extraction**: DOM wins over JSON-LD. `getProductRoot()` scopes to `<main>`; `STORE_CONFIG[].hero` selectors + scoring pick the hero container (Tesco renders hidden duplicate price blocks + a price-only sticky banner). Per-store lists are prepended to `DEFAULT_FIELDS` — selector order is load-bearing. JSON-LD `priceValidUntil` counts only when the DOM shows an offer. Modes: `asda-rollback`, `morrisons-promo`.
- **Auth is token sync, not login.** Site posts `SIFT_AUTH_TOKEN` → content script writes `chrome.storage.local.sift_token`. Popup falls back to `getToken` on the site tab (`localStorage.auth_token`). `login()` in `sift-api.ts` is unused.
- **API calls route through `background.ts`** (`apiRequest` action) so host permissions and CORS stay in one place; `sift-api.ts` falls back to `fetch` outside the extension.
- **Category is server-side.** Top-level `category` always `null`; `category_signals` (`breadcrumb_raw`, `breadcrumb_leaf`, `title`, `brand`, `store_id`, `url_path`, `jsonld_category`, `storage_text`) go to the Worker, which owns taxonomy (`../Sift/workers/lib/category.js`, `TAXONOMY_VERSION = 3`). Never re-add keyword guessing.
- **Trial**: 5 items, server-enforced; `watchlist_limit` and `trial_expired` responses drive the blocked screen.
- **`is_on_offer`** is derived at POST time: was price OR expiry OR loyalty price OR deal text.

## Key gotchas

- **Adding a store** = one `STORE_CONFIG` entry in `src/lib/store-config.ts` (id/name/logo/hosts/matches + selectors) plus a README table row. `matches`, `host_permissions`, `detectStore` and `LOYALTY_LABELS` all derive from it.
- **Debugging extraction**: `__siftDump()` in the DevTools console (context: Sift) prints every field plus the selector that matched. Auto-prints on each extraction with `?sift_debug=1` or `localStorage.sift_debug = '1'`.
- **`siftsearch.pages.dev` / `localhost:5173`** in `matches` + `host_permissions` are for session linking, not stores. On install the background script re-injects the presence `<meta>` into already-open site tabs (`scripting` permission).
- **ASDA rollbacks** carry no expiry: rollback price becomes `loyalty_price`, regular price becomes `price`, `was_price` is cleared — that is how they stay on-offer.
- **Morrisons "Now £X, Was £Y"** is More Card + regular price, not a was-strikethrough; equality rechecks drop any loyalty price duplicating the regular price.
- **`sharp`** devDependency is icon processing; install failures usually trace to it.
- **Logos**: `store_logo` strings (`/Tesco_Logo.svg`) are forwarded to the API as-is — `public/` ships extension icons only, not store logos.

## Security

- `innerHTML` in popup and overlay: every interpolated value goes through the local `escapeHtml()`. Never interpolate store-page text raw.
- Token lives only in `chrome.storage.local.sift_token`; never log it, never send it anywhere but the Sift API. Sign out removes the key.
- Permissions are deliberate: `activeTab`, `storage`, `tabs`, `scripting`. Never widen `host_permissions`/`matches` past the store list + Sift domains.
- Overlay lives in a Shadow DOM — page CSS cannot reach it, overlay CSS cannot leak out.
- Store pages are read-only input: inject only the extension's own `<style>` and button nodes, never click, submit or rewrite store markup.

## Docs (user-triggered)

- On **"finish up and update docs"** update `RECENT.md`, `ARCHITECTURE.md` (fix anything stale, ~150 lines), `README.md` only for new features / `.env` keys / commands, and `AGENTS.md` keep lean & for sweeping changes only.
- Location: `RECENT.md` + `ARCHITECTURE.md` in `/home/wsl/Repositories/markdowns/sift-markdowns/extension`; `README.md` in the repo root.
- **Stop after here.** Never commit; report the change and suggest a commit message (`feat:`, `fix:`, `chore:`, `polish:`).
