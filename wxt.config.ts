import { defineConfig } from 'wxt';
import { getStoreMatches, SITE_HOST_PERMISSIONS } from './src/lib/store-config';

export default defineConfig({
  manifest: {
    name: 'Sift - Product Extractor',
    description: 'Extract product data from UK supermarkets and add to your Sift watchlist.',
    permissions: ['activeTab', 'storage', 'tabs', 'scripting'],
    host_permissions: [
      ...getStoreMatches(),
      ...SITE_HOST_PERMISSIONS,
    ],
    action: {
      default_popup: 'popup.html',
      default_title: 'Sift',
    },
    icons: {
      '16': 'icon16.png',
      '48': 'icon48.png',
      '128': 'icon128.png',
    },
  },
});
