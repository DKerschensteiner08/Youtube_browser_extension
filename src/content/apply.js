(() => {
  const YFM = (window.YFM = window.YFM || {});

  const STYLE_ID = 'yfm-content-style';
  const TAGS = {
    shortsFallback: 'data-yfm-hidden-shorts-fallback',
    navShorts: 'data-yfm-hidden-nav-shorts',
    navExplore: 'data-yfm-hidden-nav-explore',
    navSuggestions: 'data-yfm-hidden-nav-suggestions',
  };

  let cachedBaseCss = null;

  async function getBaseCss() {
    if (cachedBaseCss !== null) return cachedBaseCss;

    try {
      const response = await fetch(chrome.runtime.getURL('content/styles.css'));
      cachedBaseCss = await response.text();
    } catch (_error) {
      cachedBaseCss = '';
    }

    return cachedBaseCss;
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

  function buildDynamicCss(context, selectors) {
    const { settings, pageType, effectiveFocusEnabled } = context;

    if (!effectiveFocusEnabled) {
      return '';
    }

    const rules = [];

    if (settings.hideShorts) {
      rules.push(`${selectors.shorts.join(', ')} { display: none !important; }`);
    }

    if (settings.hideSidebarRecs && pageType === 'watch') {
      rules.push(`${selectors.watchSidebar.join(', ')} { display: none !important; }`);
    }

    if (settings.hideComments && pageType === 'watch') {
      rules.push(`${selectors.comments.join(', ')} { display: none !important; }`);
    }

    if (settings.hideHomeFeed && pageType === 'home') {
      rules.push(`${selectors.homeFeed.join(', ')} { display: none !important; }`);
    }

    if (settings.hideNavShorts) {
      rules.push(`${selectors.navShorts.join(', ')} { display: none !important; }`);
    }

    if (settings.hideNavExplore) {
      rules.push(`${selectors.navExplore.join(', ')} { display: none !important; }`);
    }

    return rules.join('\n');
  }

  function hideElementWithTag(el, tagAttr) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.getAttribute(tagAttr) === '1') return false;

    const prevAttr = `${tagAttr}-prev`;
    el.setAttribute(tagAttr, '1');
    el.setAttribute(prevAttr, el.style.display || '');
    el.style.setProperty('display', 'none', 'important');
    return true;
  }

  function restoreElements(tagAttr) {
    const prevAttr = `${tagAttr}-prev`;
    const elements = document.querySelectorAll(`[${tagAttr}="1"]`);

    for (const el of elements) {
      if (!(el instanceof HTMLElement)) continue;
      const prev = el.getAttribute(prevAttr) || '';
      if (prev) {
        el.style.display = prev;
      } else {
        el.style.removeProperty('display');
      }
      el.removeAttribute(tagAttr);
      el.removeAttribute(prevAttr);
    }
  }

  function isShortsCandidate(node) {
    const text = (node.textContent || '').toLowerCase();
    const shortsLink = node.querySelector('a[href^="/shorts"], a[href*="/shorts/"]');
    const shortsBadge = node.querySelector(
      'ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]'
    );
    return Boolean(shortsLink || shortsBadge || text.includes('shorts'));
  }

  function applyShortsFallback(settings) {
    restoreElements(TAGS.shortsFallback);

    if (!settings.hideShorts) {
      return { shortsHiddenDelta: 0 };
    }

    const candidates = document.querySelectorAll(
      [
        'ytd-guide-entry-renderer',
        'ytd-mini-guide-entry-renderer',
        'ytd-rich-section-renderer',
        'ytd-video-renderer',
        'ytd-compact-video-renderer',
        'ytd-grid-video-renderer',
      ].join(', ')
    );

    let shortsHiddenDelta = 0;
    for (const node of candidates) {
      if (!isShortsCandidate(node)) continue;
      const newlyHidden = hideElementWithTag(node, TAGS.shortsFallback);
      if (newlyHidden && node.getAttribute('data-yfm-counted-shorts') !== '1') {
        node.setAttribute('data-yfm-counted-shorts', '1');
        shortsHiddenDelta += 1;
      }
    }

    return { shortsHiddenDelta };
  }

  function hideClosestFromLinks(selector, tagAttr) {
    restoreElements(tagAttr);

    const links = document.querySelectorAll(selector);
    for (const link of links) {
      const row = link.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer');
      if (row) {
        hideElementWithTag(row, tagAttr);
      }
    }
  }

  function applyNavSuggestionsHide(settings) {
    restoreElements(TAGS.navSuggestions);

    if (!settings.hideNavSubscriptionsSuggestions) {
      return;
    }

    const sections = document.querySelectorAll('ytd-guide-section-renderer');
    for (const section of sections) {
      const titleEl = section.querySelector('#guide-section-title, h3');
      const title = (titleEl?.textContent || '').trim().toLowerCase();
      if (title.includes('more from youtube')) {
        hideElementWithTag(section, TAGS.navSuggestions);
      }
    }
  }

  function toggleBodyClasses(context) {
    document.documentElement.classList.toggle(
      'yfm-hide-sidebar',
      context.effectiveFocusEnabled && context.settings.hideSidebarRecs && context.pageType === 'watch'
    );

    document.documentElement.classList.toggle(
      'yfm-home-feed-hidden',
      context.effectiveFocusEnabled && context.settings.hideHomeFeed && context.pageType === 'home'
    );
  }

  async function applyFocus(context) {
    const selectors = YFM.selectors;
    const styleEl = ensureStyleElement();
    const baseCss = await getBaseCss();

    toggleBodyClasses(context);

    const css = buildDynamicCss(context, selectors);
    styleEl.textContent = `${baseCss}\n${css}`;

    if (!context.effectiveFocusEnabled || YFM.pageDetect.isProtectedPage(context.pageType)) {
      restoreElements(TAGS.shortsFallback);
      restoreElements(TAGS.navShorts);
      restoreElements(TAGS.navExplore);
      restoreElements(TAGS.navSuggestions);
      YFM.keywordFilter.restoreKeywordHidden();
      return { videosHiddenDelta: 0, shortsHiddenDelta: 0 };
    }

    const shorts = applyShortsFallback(context.settings);

    if (context.settings.hideNavShorts) {
      hideClosestFromLinks(selectors.navShorts.join(', '), TAGS.navShorts);
    } else {
      restoreElements(TAGS.navShorts);
    }

    if (context.settings.hideNavExplore) {
      hideClosestFromLinks(selectors.navExplore.join(', '), TAGS.navExplore);
    } else {
      restoreElements(TAGS.navExplore);
    }

    applyNavSuggestionsHide(context.settings);

    const keyword = YFM.keywordFilter.applyKeywordFilter({
      settings: context.settings,
      pageType: context.pageType,
      selectors,
    });

    return {
      videosHiddenDelta: keyword.videosHiddenDelta,
      shortsHiddenDelta: shorts.shortsHiddenDelta,
    };
  }

  YFM.apply = {
    applyFocus,
  };
})();
