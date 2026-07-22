import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Sift - Product Extractor',
    description: 'Extract product data from UK supermarkets and add to your Sift watchlist.',
    permissions: ['activeTab', 'storage', 'tabs'],
    host_permissions: [
      'https://www.tesco.com/*',
      'https://www.sainsburys.co.uk/*',
      'https://groceries.asda.com/*',
      'https://groceries.morrisons.com/*',
      'https://www.marksandspencer.com/*',
      'https://www.aldi.co.uk/*',
      'https://www.lidl.co.uk/*',
      'https://www.coop.co.uk/*',
      'https://www.waitrose.com/*',
      'https://www.iceland.co.uk/*',
      'https://www.ocado.com/*',
      'https://siftapi.blackmesa.workers.dev/*',
      'https://siftsearch.pages.dev/*',
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
