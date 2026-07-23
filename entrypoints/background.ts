export default defineBackground({
  main() {
    chrome.runtime.onInstalled.addListener(async () => {
      const tabs = await chrome.tabs.query({
        url: ['https://siftsearch.pages.dev/*', 'http://localhost:5173/*'],
      });
      for (const tab of tabs) {
        if (!tab.id) continue;
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              if (document.querySelector('meta[name="sift-extension"]')) return;
              const meta = document.createElement('meta');
              meta.name = 'sift-extension';
              meta.content = 'installed';
              document.head.appendChild(meta);
              window.postMessage({ type: 'SIFT_EXTENSION_INSTALLED' }, '*');
              document.dispatchEvent(new CustomEvent('sift-extension-installed'));
            },
          });
        } catch {
          // Tab might have been closed
        }
      }
    });
  },
});
