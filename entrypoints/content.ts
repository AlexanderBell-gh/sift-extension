import type { ExtractedProduct } from '../src/types';
import { extractProduct } from '../src/lib/extract';

export default defineContentScript({
  matches: [
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
    'https://siftsearch.pages.dev/*',
  ],
  main() {
    if (window.location.hostname === 'siftsearch.pages.dev') {
      const meta = document.createElement('meta');
      meta.name = 'sift-extension';
      meta.content = 'installed';
      document.head.appendChild(meta);
      window.postMessage({ type: 'SIFT_EXTENSION_INSTALLED' }, '*');
    }

    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request.action === 'extract') {
        const product = extractProduct();
        sendResponse({ product });
      }
      if (request.action === 'getToken') {
        const token = localStorage.getItem('auth_token');
        sendResponse({ token });
      }
      return true;
    });
  },
});
