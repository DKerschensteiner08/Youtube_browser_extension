(() => {
  const YFM = (window.YFM = window.YFM || {});

  // Selector registry: update here first when YouTube markup shifts.
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
      'yt-tab-shape[tab-title="Shorts"]',
      'yt-tab-shape[aria-label*="Shorts"]',
    ],
    navShorts: [
      'ytd-guide-entry-renderer a[href^="/shorts"]',
      'ytd-mini-guide-entry-renderer a[href^="/shorts"]',
      'a[title="Shorts"][href^="/shorts"]',
    ],
    navExplore: [
      'ytd-guide-entry-renderer a[href^="/feed/explore"]',
      'ytd-guide-entry-renderer a[href^="/feed/trending"]',
      'ytd-mini-guide-entry-renderer a[href^="/feed/explore"]',
      'ytd-mini-guide-entry-renderer a[href^="/feed/trending"]',
    ],
    navSubscriptionsSuggestions: [
      'ytd-guide-section-renderer:has(#guide-section-title)',
      'ytd-guide-section-renderer',
    ],
    watchSidebar: [
      '#secondary',
      'ytd-watch-next-secondary-results-renderer',
      'ytd-watch-flexy[is-two-columns_] #secondary-inner',
    ],
    comments: ['#comments', 'ytd-comments'],
    homeFeed: [
      'ytd-browse[page-subtype="home"] #primary',
      'ytd-rich-grid-renderer',
      'ytd-browse[page-subtype="home"] #contents ytd-rich-item-renderer',
    ],
    videoRenderers: [
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-compact-video-renderer',
      'ytd-grid-video-renderer',
      'ytd-playlist-video-renderer',
    ],
    videoTitleCandidates: [
      '#video-title',
      '#video-title-link',
      'a#video-title-link',
      'yt-formatted-string#video-title',
      '#title-wrapper h3 a',
    ],
    relatedContainer: ['#secondary #items', 'ytd-watch-next-secondary-results-renderer #items'],
  };

  YFM.selectors = SELECTORS;
})();
