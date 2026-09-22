const SIFT_LOGO = `<svg class="header-logo" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <mask id="logo-hole">
      <rect width="32" height="32" fill="white"/>
      <circle cx="16" cy="9" r="3" fill="black"/>
    </mask>
  </defs>
  <g transform="rotate(-10 16 16)">
    <rect x="6" y="2" width="20" height="28" rx="4" fill="#FF5701" mask="url(#logo-hole)"/>
  </g>
</svg>`;

const LINK_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6.5 9.5L9.5 6.5M7 11L5.5 12.5C4.5 13.5 3 13.5 2 12.5C1 11.5 1 10 2 9L3.5 7.5M9 5L10.5 3.5C11.5 2.5 13 2.5 14 3.5C15 4.5 15 6 14 7L12.5 8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const LOGOUT_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16 17L21 12L16 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const CHECK_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M5 13l4 4L19 7" stroke="#FF5701" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const CHEVRON_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const POSITIONS = [
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
];

const app = document.getElementById('app')!;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let token = '';

async function init() {
  const stored = await chrome.storage.local.get('sift_token');
  token = stored.sift_token || '';

  if (!token) {
    const tabs = await chrome.tabs.query({ url: ['https://siftsearch.pages.dev/*', 'http://localhost:5173/*'] });
    if (tabs.length > 0 && tabs[0].id) {
      try {
        const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getToken' });
        if (response?.token) {
          token = response.token;
          await chrome.storage.local.set({ sift_token: token });
        }
      } catch {
        // Content script not ready or tab unavailable
      }
    }

    if (!token) {
      renderLogin();
      return;
    }
  }

  renderSettings();
}

function renderLogin() {
  app.innerHTML = `
    <div class="header">
      ${SIFT_LOGO}
      <h1>Sift</h1>
    </div>
    <div class="auth-prompt">
      <p class="auth-prompt-title">Sign in to Sift to get started.</p>
      <p class="auth-prompt-text">Open siftsearch.pages.dev, sign in to your account, and your session will sync to the extension automatically.</p>
      <button class="btn btn-primary" id="open-sift-btn">Open Sift</button>
    </div>
  `;

  document.getElementById('open-sift-btn')!.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://siftsearch.pages.dev' });
  });
}

async function renderSettings() {
  const stored = await chrome.storage.local.get('sift_overlay_position');
  const position = stored.sift_overlay_position || 'bottom-left';

  app.innerHTML = `
    <div class="header">
      ${SIFT_LOGO}
      <h1>Sift</h1>
    </div>
    <div class="settings">
      <div class="settings-section">
        <span class="field-label" id="position-label">Overlay Position</span>
        <div class="pos-wrap" id="position-wrap">
          <button type="button" class="pos-trigger" id="position-trigger" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="position-label position-trigger-label">
            <span id="position-trigger-label">${escapeHtml(POSITIONS.find(p => p.value === position)?.label || 'Bottom Left')}</span>
            <span class="pos-chevron">${CHEVRON_ICON}</span>
          </button>
          <div class="pos-panel" id="position-panel" role="listbox" aria-labelledby="position-label" hidden>
            ${POSITIONS.map(p => `
              <button type="button" class="pos-option${p.value === position ? ' pos-option-selected' : ''}" role="option" aria-selected="${p.value === position ? 'true' : 'false'}" data-value="${p.value}">
                <span class="pos-option-label">${p.label}</span>
                <span class="pos-checkmark">${p.value === position ? CHECK_ICON : ''}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="settings-links">
        <a class="settings-link" id="watchlist-link" href="https://siftsearch.pages.dev/watchlist" target="_blank">
          <span class="settings-link-icon">${LINK_ICON}</span>
          Open Watchlist
        </a>
        <button class="settings-link settings-link--danger" id="sign-out-btn">
          <span class="settings-link-icon">${LOGOUT_ICON}</span>
          Sign Out
        </button>
      </div>
    </div>
  `;

  const wrap = document.getElementById('position-wrap')!;
  const trigger = document.getElementById('position-trigger') as HTMLButtonElement;
  const triggerLabel = document.getElementById('position-trigger-label')!;
  const panel = document.getElementById('position-panel')!;
  const options = [...panel.querySelectorAll<HTMLButtonElement>('.pos-option')];
  let isOpen = false;

  function setOpen(open: boolean) {
    isOpen = open;
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.hidden = !open;
    if (open) {
      options.find(o => o.getAttribute('aria-selected') === 'true')?.focus();
    }
  }

  async function selectOption(option: HTMLButtonElement) {
    const val = option.dataset.value!;
    await chrome.storage.local.set({ sift_overlay_position: val });
    triggerLabel.textContent = POSITIONS.find(p => p.value === val)?.label || val;
    for (const o of options) {
      const selected = o === option;
      o.setAttribute('aria-selected', selected ? 'true' : 'false');
      o.classList.toggle('pos-option-selected', selected);
      o.querySelector('.pos-checkmark')!.innerHTML = selected ? CHECK_ICON : '';
    }
    setOpen(false);
    trigger.focus();
  }

  trigger.addEventListener('click', () => setOpen(!isOpen));

  for (const option of options) {
    option.addEventListener('click', () => selectOption(option));
  }

  document.addEventListener('mousedown', (e) => {
    if (isOpen && !wrap.contains(e.target as Node)) setOpen(false);
  });

  wrap.addEventListener('focusout', (e) => {
    if (isOpen && !wrap.contains((e as FocusEvent).relatedTarget as Node)) setOpen(false);
  });

  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      setOpen(false);
      trigger.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setOpen(true);
        return;
      }
      const idx = options.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.key === 'ArrowDown'
        ? options[(idx + 1) % options.length]
        : options[(idx - 1 + options.length) % options.length];
      next.focus();
    } else if (e.key === 'Home' && isOpen) {
      e.preventDefault();
      options[0].focus();
    } else if (e.key === 'End' && isOpen) {
      e.preventDefault();
      options[options.length - 1].focus();
    }
  });

  document.getElementById('sign-out-btn')!.addEventListener('click', async () => {
    await chrome.storage.local.remove('sift_token');
    token = '';
    renderLogin();
  });
}

init();
