(() => {
  const YFM = (window.YFM = window.YFM || {});

  const URL_POLL_MS = 500;
  const APPLY_DEBOUNCE_MS = 250;

  function createObserverController(onApply) {
    let debounceTimer = null;
    let lastUrl = location.href;

    function invokeApply() {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(
          () => {
            onApply();
          },
          { timeout: 500 }
        );
      } else {
        setTimeout(onApply, 0);
      }
    }

    function scheduleApply() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        invokeApply();
      }, APPLY_DEBOUNCE_MS);
    }

    function patchHistoryEvents() {
      if (window.__yfmHistoryPatched) return;
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

    function onUrlMaybeChanged() {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      scheduleApply();
    }

    function start() {
      patchHistoryEvents();

      const observer = new MutationObserver(() => {
        scheduleApply();
      });

      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }

      setInterval(onUrlMaybeChanged, URL_POLL_MS);
      window.addEventListener('popstate', scheduleApply);
      window.addEventListener('yt-navigate-finish', scheduleApply);
      window.addEventListener('yfm-url-change', scheduleApply);
      window.addEventListener('yfm-settings-updated-locally', scheduleApply);
    }

    return {
      start,
      scheduleApply,
    };
  }

  YFM.observer = {
    createObserverController,
  };
})();
