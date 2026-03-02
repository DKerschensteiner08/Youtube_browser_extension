(() => {
  const YFM = (window.YFM = window.YFM || {});

  function detectPageType(url = location.href) {
    const parsed = new URL(url);
    const path = parsed.pathname;

    if (path === '/' || path === '') return 'home';
    if (path === '/watch') return 'watch';
    if (path.startsWith('/results')) return 'search';
    if (path.startsWith('/shorts')) return 'shorts';
    if (path.startsWith('/feed/subscriptions')) return 'subscriptions';
    if (path.startsWith('/feed/history')) return 'history';
    return 'other';
  }

  function isProtectedPage(pageType) {
    return pageType === 'subscriptions' || pageType === 'history';
  }

  YFM.pageDetect = {
    detectPageType,
    isProtectedPage,
  };
})();
