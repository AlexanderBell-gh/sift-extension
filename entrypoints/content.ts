import type { ExtractedProduct } from '../src/types';
import { dumpProduct, extractProduct } from '../src/lib/extract';
import { initOverlay } from '../src/lib/overlay';
import { getStoreMatches, SITE_MATCHES } from '../src/lib/store-config';

export default defineContentScript({
  matches: [...getStoreMatches(), ...SITE_MATCHES],
  main() {
    // DevTools console -> context dropdown -> Sift -> __siftDump()
    (window as unknown as { __siftDump?: () => void }).__siftDump = () => console.log(dumpProduct());

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
        const product: ExtractedProduct | null = extractProduct();
        sendResponse({ product });
      }
      if (request.action === 'getToken') {
        const token = localStorage.getItem('auth_token');
        sendResponse({ token });
      }
      return true;
    });

    initOverlay();
  },
});
