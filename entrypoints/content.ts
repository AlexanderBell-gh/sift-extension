import type { ExtractedProduct } from '../src/types';
import { extractProduct } from '../src/lib/extract';

export default defineContentScript({
  matches: [
    'https://www.tesco.com/*',
    'https://www.sainsburys.co.uk/*',
    'https://www.asda.com/groceries/*',
    'https://groceries.morrisons.com/*',
    'https://www.marksandspencer.com/*',
    'https://www.aldi.co.uk/*',
    'https://www.lidl.co.uk/*',
    'https://www.coop.co.uk/*',
    'https://www.waitrose.com/*',
    'https://www.iceland.co.uk/*',
    'https://www.ocado.com/*',
    'https://siftsearch.pages.dev/*',
    'http://localhost:5173/*'
  ],
  main() {
    if (window.location.hostname === 'siftsearch.pages.dev' || window.location.hostname === 'localhost') {
      const meta = document.createElement('meta');
      meta.name = 'sift-extension';
      meta.content = 'installed';
      document.head.appendChild(meta);
      window.postMessage({ type: 'SIFT_EXTENSION_INSTALLED' }, '*');
      document.dispatchEvent(new CustomEvent('sift-extension-installed'));

      window.addEventListener('message', (e) => {
        if (e.data?.type === 'SIFT_AUTH_TOKEN') {
          if (e.data.token) {
            chrome.storage.local.set({ sift_token: e.data.token });
          } else {
            chrome.storage.local.remove('sift_token');
          }
        }
      });
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
