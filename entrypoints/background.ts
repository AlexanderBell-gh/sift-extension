export default defineBackground({
  main() {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request.action === 'apiRequest') {
        fetch(request.url, request.options)
          .then(async (response) => {
            const body = await response.json().catch(() => ({}));
            sendResponse({ ok: response.ok, status: response.status, body });
          })
          .catch((err) => {
            sendResponse({ ok: false, status: 0, body: { error: err.message } });
          });
        return true;
      }
    });

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
