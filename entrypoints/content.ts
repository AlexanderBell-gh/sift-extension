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
  ],
  main() {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request.action === 'extract') {
        const product = extractProduct();
        sendResponse({ product });
      }
      return true;
    });
  },
});
