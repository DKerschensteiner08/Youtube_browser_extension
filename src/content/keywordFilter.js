(() => {
  const YFM = (window.YFM = window.YFM || {});

  const HIDE_ATTR = 'data-yfm-hidden-keyword';
  const PREV_ATTR = 'data-yfm-prev-display-keyword';
  const COUNTED_ATTR = 'data-yfm-counted-keyword';

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  }

  function compilePatterns(settings) {
    const words = Array.isArray(settings.keywords) ? settings.keywords : [];
    if (!settings.keywordEnabled || !words.length) return [];

    const patterns = [];
    for (const word of words) {
      const raw = String(word || '').trim();
      if (!raw) continue;
      const source = settings.keywordMatchWholeWord ? `\\b${escapeRegExp(raw)}\\b` : escapeRegExp(raw);
      const flags = settings.keywordCaseSensitive ? '' : 'i';
      patterns.push(new RegExp(source, flags));
    }
    return patterns;
  }

  function getTextForRenderer(renderer, selectors) {
    const candidates = renderer.querySelectorAll(selectors.videoTitleCandidates.join(', '));
    for (const node of candidates) {
      const text = (node.textContent || '').trim();
      if (text) return text;
    }
    return '';
  }

  function getRoots(pageType, selectors) {
    if (pageType === 'home') {
      const homeGrid = document.querySelector('ytd-rich-grid-renderer #contents');
      return homeGrid ? [homeGrid] : [];
    }

    if (pageType === 'search') {
      const searchResults = document.querySelector('ytd-two-column-search-results-renderer #primary');
      return searchResults ? [searchResults] : [];
    }

    if (pageType === 'watch') {
      const roots = [];
      for (const selector of selectors.relatedContainer) {
        const root = document.querySelector(selector);
        if (root) roots.push(root);
      }
      return roots;
    }

    return [];
  }

  function restoreKeywordHidden() {
    const nodes = document.querySelectorAll(`[${HIDE_ATTR}="1"]`);
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      const prev = node.getAttribute(PREV_ATTR) || '';
      if (prev) {
        node.style.display = prev;
      } else {
        node.style.removeProperty('display');
      }
      node.removeAttribute(HIDE_ATTR);
      node.removeAttribute(PREV_ATTR);
    }
  }

  function applyKeywordFilter({ settings, pageType, selectors }) {
    restoreKeywordHidden();

    const patterns = compilePatterns(settings);
    if (!patterns.length) {
      return { videosHiddenDelta: 0 };
    }

    const roots = getRoots(pageType, selectors);
    if (!roots.length) {
      return { videosHiddenDelta: 0 };
    }

    const seen = new Set();
    let videosHiddenDelta = 0;

    for (const root of roots) {
      const nodes = root.querySelectorAll(selectors.videoRenderers.join(', '));
      for (const node of nodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (seen.has(node)) continue;
        seen.add(node);

        const title = getTextForRenderer(node, selectors);
        if (!title) continue;

        const matches = patterns.some((pattern) => pattern.test(title));
        if (!matches) continue;

        if (node.getAttribute(HIDE_ATTR) !== '1') {
          node.setAttribute(HIDE_ATTR, '1');
          node.setAttribute(PREV_ATTR, node.style.display || '');
          node.style.setProperty('display', 'none', 'important');
        }

        if (node.getAttribute(COUNTED_ATTR) !== '1') {
          node.setAttribute(COUNTED_ATTR, '1');
          videosHiddenDelta += 1;
        }
      }
    }

    return { videosHiddenDelta };
  }

  YFM.keywordFilter = {
    applyKeywordFilter,
    restoreKeywordHidden,
  };
})();
