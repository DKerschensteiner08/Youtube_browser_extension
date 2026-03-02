(() => {
  const DEFAULT_SETTINGS = {
    focusEnabled: true,
    hideShorts: true,
    hideSidebarRecs: false,
    hideComments: false,
    hideHomeFeed: false,
  };

  const STYLE_ID = 'yt-focus-mode-style';
  const URL_POLL_MS = 500;
  const APPLY_DEBOUNCE_MS = 250;

  // Central selector list: update this section first when YouTube changes layout markup.
  const SELECTORS = {
    shorts: [
      'ytd-rich-section-renderer[is-shorts]',
      'ytd-reel-shelf-renderer',
      'ytd-reel-item-renderer',
      'ytd-video-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"])',
      'ytd-compact-video-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"])',
      'ytd-grid-video-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"])',
      'a[href^="/shorts"]',
      'a[href*="/shorts/"]',
      'ytd-guide-entry-renderer a[href="/shorts"]',
      'ytd-mini-guide-entry-renderer a[href="/shorts"]',
      'yt-tab-shape[tab-title="Shorts"]',
      'yt-tab-shape[aria-label*="Shorts"]',
    ],
    watchSidebar: [
      '#secondary',
      'ytd-watch-next-secondary-results-renderer',
      'ytd-watch-flexy[is-two-columns_] #secondary-inner',
    ],
    comments: [
      '#comments',
      'ytd-comments',
      'ytd-item-section-renderer#sections #comments',
    ],
    homeFeed: [
      'ytd-browse[page-subtype="home"] #primary',
      'ytd-rich-grid-renderer',
      'ytd-browse[page-subtype="home"] #contents ytd-rich-item-renderer',
    ],
  };

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    lastUrl: location.href,
    debounceTimer: null,
  };

  function normalizeSettings(settings) {
    return {
      focusEnabled: Boolean(settings.focusEnabled),
      hideShorts: Boolean(settings.hideShorts),
      hideSidebarRecs: Boolean(settings.hideSidebarRecs),
      hideComments: Boolean(settings.hideComments),
      hideHomeFeed: Boolean(settings.hideHomeFeed),
    };
  }

  function detectPageType() {
    const { pathname } = location;

    if (pathname === '/' || pathname === '') return 'home';
    if (pathname === '/watch') return 'watch';
    if (pathname.startsWith('/results')) return 'search';
    if (pathname.startsWith('/shorts')) return 'shorts';
    if (pathname.startsWith('/feed/subscriptions')) return 'subscriptions';
    if (pathname.startsWith('/feed/history')) return 'history';
    return 'other';
  }

  function ensureStyleElement() {
    let styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      document.documentElement.appendChild(styleEl);
    }
    return styleEl;
  }

  function buildCssRules(pageType) {
    const settings = state.settings;

    if (!settings.focusEnabled) {
      return '';
    }

    const rules = [];

    if (settings.hideShorts) {
      rules.push(`${SELECTORS.shorts.join(', ')} { display: none !important; }`);
    }

    if (settings.hideSidebarRecs && pageType === 'watch') {
      rules.push(`${SELECTORS.watchSidebar.join(', ')} { display: none !important; }`);
      rules.push('ytd-watch-flexy[is-two-columns_] #primary { max-width: 100% !important; }');
    }

    if (settings.hideComments && pageType === 'watch') {
      rules.push(`${SELECTORS.comments.join(', ')} { display: none !important; }`);
    }

    if (settings.hideHomeFeed && pageType === 'home') {
      rules.push(`${SELECTORS.homeFeed.join(', ')} { display: none !important; }`);
    }

    return rules.join('\n');
  }

  function hideElement(el, tag) {
    if (!(el instanceof HTMLElement)) {
      return;
    }

    if (el.dataset.yfmHiddenBy === tag) {
      return;
    }

    el.dataset.yfmHiddenBy = tag;
    el.dataset.yfmPrevDisplay = el.style.display || '';
    el.style.setProperty('display', 'none', 'important');
  }

  function restoreTaggedElements(tag) {
    const elements = document.querySelectorAll(`[data-yfm-hidden-by="${tag}"]`);
    for (const el of elements) {
      if (!(el instanceof HTMLElement)) {
        continue;
      }
      const prevDisplay = el.dataset.yfmPrevDisplay || '';
      if (prevDisplay) {
        el.style.display = prevDisplay;
      } else {
        el.style.removeProperty('display');
      }
      delete el.dataset.yfmHiddenBy;
      delete el.dataset.yfmPrevDisplay;
    }
  }

  function isShortsCandidate(el) {
    const text = (el.textContent || '').toLowerCase();
    const hasShortsLink = Boolean(el.querySelector('a[href^="/shorts"], a[href*="/shorts/"]'));
    const hasShortsBadge = Boolean(
      el.querySelector('ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]')
    );

    if (hasShortsLink || hasShortsBadge) {
      return true;
    }

    // Conservative text fallback for shelf/tab labels that may lose stable attributes.
    return text.includes('shorts');
  }

  function applyShortsFallback() {
    restoreTaggedElements('shorts-fallback');

    if (!state.settings.focusEnabled || !state.settings.hideShorts) {
      return;
    }

    const fallbackTargets = document.querySelectorAll(
      [
        'ytd-guide-entry-renderer',
        'ytd-mini-guide-entry-renderer',
        'ytd-rich-section-renderer',
        'ytd-video-renderer',
        'ytd-compact-video-renderer',
        'ytd-grid-video-renderer',
      ].join(', ')
    );

    for (const node of fallbackTargets) {
      if (isShortsCandidate(node)) {
        hideElement(node, 'shorts-fallback');
      }
    }
  }

  function applyFocus() {
    if (!document.documentElement) {
      return;
    }

    const pageType = detectPageType();
    const styleEl = ensureStyleElement();
    styleEl.textContent = buildCssRules(pageType);

    applyShortsFallback();
  }

  function scheduleApply() {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      applyFocus();
    }, APPLY_DEBOUNCE_MS);
  }

  async function loadSettings() {
    const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    state.settings = normalizeSettings({ ...DEFAULT_SETTINGS, ...stored });
  }

  function handleUrlChange() {
    if (location.href === state.lastUrl) {
      return;
    }

    state.lastUrl = location.href;
    scheduleApply();
  }

  function patchHistoryEvents() {
    if (window.__yfmHistoryPatched) {
      return;
    }

    window.__yfmHistoryPatched = true;

    const wrap = (methodName) => {
      const original = history[methodName];
      history[methodName] = function patchedHistoryMethod(...args) {
        const result = original.apply(this, args);
        window.dispatchEvent(new Event('yfm-url-change'));
        return result;
      };
    };

    wrap('pushState');
    wrap('replaceState');
  }

  function setupObservers() {
    patchHistoryEvents();

    const observer = new MutationObserver(() => {
      scheduleApply();
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    setInterval(handleUrlChange, URL_POLL_MS);
    window.addEventListener('popstate', scheduleApply);
    window.addEventListener('yt-navigate-finish', scheduleApply);
    window.addEventListener('yfm-url-change', scheduleApply);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'SETTINGS_UPDATED') {
      state.settings = normalizeSettings({ ...DEFAULT_SETTINGS, ...message.settings });
      scheduleApply();
      sendResponse({ ok: true });
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') {
      return;
    }

    const nextSettings = { ...state.settings };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (changes[key]) {
        nextSettings[key] = Boolean(changes[key].newValue);
      }
    }

    state.settings = normalizeSettings(nextSettings);
    scheduleApply();
  });

  loadSettings()
    .then(() => {
      applyFocus();
      setupObservers();
    })
    .catch(() => {
      state.settings = { ...DEFAULT_SETTINGS };
      applyFocus();
      setupObservers();
    });
})();
