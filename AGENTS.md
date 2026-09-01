# Sift Extension — Agent Guide

## Session Start
> **Rule**: Activate the `/caveman` Skill at `full` intensity


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
pnpm install
pnpm run dev          # watch mode (WXT)
pnpm run build        # production build
pnpm run zip          # package for distribution
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
  types.ts            ExtractedProduct interface
  lib/
    extract.ts        DOM + JSON-LD product extraction (core logic, ~635 lines)
    category-map.ts   Keyword-based product categorisation
    sift-api.ts       Auth + watchlist API client
    loyalty.ts        Per-store loyalty label mapping
public/               Extension icons (SVG, PNG 16/48/128)
wxt.config.ts         Manifest — permissions, host_permissions, action config
```

- Frontend entry: `entrypoints/popup/popup.ts` (WXT wires `popup.html`)
- Content script entry: `entrypoints/content.ts` → `src/lib/extract.ts`
- Output: `.output/chrome-mv3/` — load unpacked via `chrome://extensions` → Developer mode

## Key gotchas

- **Adding a store** requires updating 4 files: `detectStore()` in `src/lib/extract.ts`, `host_permissions` in `wxt.config.ts`, `matches` in `entrypoints/content.ts`, and `LOYALTY_LABELS` in `src/lib/loyalty.ts`.
- **`siftsearch.pages.dev`** in `matches`/`host_permissions` is for session linking — it is NOT a store. Background and content scripts signal extension presence there.
- **Extraction strategy**: JSON-LD + DOM merge, DOM priority. Scoped to `<main>` via `getProductRoot()`. Store-specific selectors for prices, expiry, category.
- **Token storage**: `chrome.storage.local` key `sift_token`. API URL hardcoded in `src/lib/sift-api.ts`.
- **Trial accounts**: limited to 5 watchlist items, enforced server-side by `watchlist_limit` response.
- **ASDA rollbacks** have no expiry — counted as on-offer via rollback price.
- **Morrisons "Now £X, Was £Y"** pattern is handled as More Card + regular price, not loyalty.
- **`sharp`** is a devDependency (icon processing). If install fails on some systems, it is the likely cause.

## Discovering recent changes

Use git to see what changed recently rather than reading file lists:

```bash
git log -n 5 --stat           # last 5 commits with file stats
git status                    # uncommitted changes
git diff                      # unstaged changes
git diff --cached             # staged changes
```

## External Documentation

 - Design tokens: `/home/wsl/Projects/markdowns/Sift-Markdowns/DESIGN.md`

## Session Lifecycle Rules

### Multi-Doc Conclusion Protocol
Whenever the user says **"lets finish up and update the docs"**, you MUST perform the following documentation updates before stopping:

1. **Update MEMORY.md:**
   * Insert a reverse-chronological entry directly under the `## Session History` header.
   * Location: `home/wsl/Projects/markdowns/Sift-Markdowns/Extension/MEMORY.md`
   
 ### **Format:**
     ### 📅 [DD-MM-YYYY] @ [HH:MM 24-hr] | [Short Session Title]
     * **Changes:** [One-sentence summary of what was accomplished].
     * **Impacted Files:** `[file_1.ext]`, `[file_2.ext]`.
     * **Left Off At:** [One-sentence summary of outstanding next steps].

2. **Update CONTEXT.md:**
   * Review the current architectural state, tech stack details, or data flows.
   * Update any outdated sections to reflect the exact state of the codebase at the end of this session.
   * Location: `home/wsl/Projects/markdowns/Sift-Markdowns/Extension/CONTEXT.md`

3. **Update README.md:**
   * Review `README.md`. If the session introduced new features, configuration keys (`.env`), or changed installation/build commands, update those specific sections. Do not alter stable project descriptions unless explicitly relevant.
   * Location: `/home/wsl/Projects/sift-extension/README.md`

4. **Guard AGENTS.md (Strict Rule):**
   * **DO NOT** update `AGENTS.md` unless it is completely necessary. 
   * Updates to this file are strictly reserved for critical, sweeping architectural shifts, fundamental changes to the core tech stack, or major global project rules. Do not modify it for routine features, refactors, or bug fixes - this is to be kept very lean.
   * Location: `/home/wsl/Projects/sift-extension/AGENTS.md`