# Sift Extension

Chrome MV3 browser extension for [Sift](https://siftsearch.pages.dev) — UK supermarket price tracker. Extracts product data from store pages and adds to your Sift watchlist.

## Install

1. Download the [latest release](https://github.com/Alex-Projects-Master/sift-extension/releases) (`.zip`)
2. Unzip to a folder
3. Open `chrome://extensions`
4. Enable **Developer Mode** (top right)
5. Click **Load unpacked** → select the folder

## Usage

Browse to any supported store → click the extension icon → review product data → **Add to Watchlist**.

## Supported Stores

Tesco, Sainsbury's, ASDA, Morrisons, M&S, Aldi, Lidl, Co-op, Waitrose, Iceland, Ocado.

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
- Host permissions for 11 store domains + Sift API + siftsearch.pages.dev

## Auth

- **Login:** username + password via Sift API
- **Link account:** "Link Sift Account" button reads token from siftsearch.pages.dev's localStorage via content script
- **Token stored** in `chrome.storage.local` as `sift_token`

## Trial Users

Trial accounts are limited to **5 watchlist items**. When full, the extension shows a blocked screen with a link to manage items on your Watchlist page.
