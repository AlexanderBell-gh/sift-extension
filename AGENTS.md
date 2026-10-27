# AGENTS.md

## Session rules

- **On startup skills**: `@caveman` at `full` intensity, all session, until told otherwise.
- **Prefix every shell command with:** `rtk` — e.g. `rtk git log -5`.
- **Only use read-only git commands**: `status`, `log`, `diff`, `diff --cached`, `show`, `blame`. **Never use**: `commit`, `push`, `reset`, `rebase` or `amend`.


## Tech Stack

| Layer | Stack |
|-------|-------|
| Framework | WXT (web extension toolkit) — entrypoints, manifest, build pipeline |
| Language | TypeScript, strict mode, ESNext target |
| Package mgr | pnpm |
| Build | `wxt build` → `.output/chrome-mv3/` |
| Backend API | Cloudflare Worker (`siftapi.blackmesa.workers.dev`) |

## Commands

```bash
rtk pnpm install
rtk pnpm run dev          # watch mode (WXT)
rtk pnpm run build        # production build
rtk pnpm run zip          # package for distribution
```

**No lint, test, typecheck, or formatter commands exist.**

## Repository structure

```
entrypoints/
  background.ts       Service worker — injects presence signal on install
  content.ts          Content script — extracts product data, serves messages
  popup/
    index.html        Popup shell (inline styles, 320px width)
    popup.ts          Popup logic — login, product display, add to watchlist
src/
  types.ts            ExtractedProduct + CategorySignals interfaces
  lib/
    extract.ts        DOM + JSON-LD product extraction (category always null, worker owns taxonomy)
    sift-api.ts       Auth + watchlist API client
    loyalty.ts        Per-store loyalty label mapping
    overlay.ts/css    Floating button + Shadow DOM overlay
public/               Extension icons (SVG, PNG 16/48/128)
wxt.config.ts         Manifest — permissions, host_permissions, action config
```

> For the main Sift `/home/wsl/Repositories/Sift`

- Frontend entry: `entrypoints/popup/popup.ts` (WXT wires `popup.html`)
- Content script entry: `entrypoints/content.ts` → `src/lib/extract.ts`
- Output: `.output/chrome-mv3/` — load unpacked via `chrome://extensions` → Developer mode

## Key gotchas

- **Adding a store** requires updating 4 files: `detectStore()` in `src/lib/extract.ts`, `host_permissions` in `wxt.config.ts`, `matches` in `entrypoints/content.ts`, and `LOYALTY_LABELS` in `src/lib/loyalty.ts`.
- **`siftsearch.pages.dev`** in `matches`/`host_permissions` is for session linking — it is NOT a store. Background and content scripts signal extension presence there.
- **Extraction strategy**: JSON-LD + DOM merge, DOM priority. Scoped to `<main>` via `getProductRoot()`. Store-specific selectors for prices, expiry, category.
- **Token storage**: `chrome.storage.local` key `sift_token`. API URL hardcoded in `src/lib/sift-api.ts`.
- **Trial accounts**: limited to 5 watchlist items, enforced server-side by `watchlist_limit` response.
- **Category taxonomy lives server-side** (`../Sift/workers/lib/category.js`, `TAXONOMY_VERSION = 3`). Extension sends `category: null` + `category_signals`. Never re-add keyword guessing.
- **ASDA rollbacks** have no expiry — counted as on-offer via rollback price.
- **Morrisons "Now £X, Was £Y"** pattern is handled as More Card + regular price, not loyalty.
- **`sharp`** is a devDependency (icon processing). If install fails on some systems, it is the likely cause.


## Docs (user-triggered)

- On **"finish up and update docs"** update `RECENT.md`, `ARCHITECTURE.md` (fix anything stale, ~150 lines), `README.md` only for new features / `.env` keys / commands, and `AGENTS.md` keep lean & for sweeping changes only. 
- Location: `RECENT.md` + `ARCHITECTURE.md` in `/home/wsl/Repositories/markdowns/sift-markdowns/extension`; `README.md` in the repo root.
- **Stop after here.** Never commit; report the change and suggest a commit message (`feat:`, `fix:`, `chore:`, `polish:`).
