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
- `tabs` — query for siftsearch.pages.dev tabs to link website session
- Host permissions for 11 store domains + Sift API + siftsearch.pages.dev

## Auth

- **Login:** username + password via `POST /api/auth/login`
- **Link account:** "Link Sift Account" button reads `auth_token` from siftsearch.pages.dev's localStorage via content script
- **Token stored** in `chrome.storage.local` as `sift_token`

## Trial Users

Trial accounts are limited to 5 watchlist items. When full, the extension shows a blocked screen with a link to manage items on your Watchlist page.
