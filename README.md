# Sift Extension

Chrome MV3 browser extension for [Sift](https://siftsearch.pages.dev) — UK supermarket price tracker.

Extracts product data from store pages and adds them to your Sift watchlist.

## Supported Stores

Tesco, Sainsbury's, ASDA, Morrisons, M&S, Aldi, Lidl, Co-op, Waitrose, Iceland, Ocado.

## Development

```bash
pnpm install
pnpm run dev
```

Load unpacked: `chrome://extensions` → Enable Developer Mode → Load unpacked → select `.output/chrome-mv3/`

## Build

```bash
pnpm run build
```

Output: `.output/chrome-mv3/`

## How It Works

1. Content script extracts product data from store pages (DOM selectors + JSON-LD fallback)
2. Popup shows product preview with name, price, image, and store
3. Click "Add to Watchlist" to pin the product to your Sift account via the API

## Permissions

- `activeTab` — access current tab's content
- `storage` — persist login token
- Host permissions for all 11 supported store domains + Sift API
