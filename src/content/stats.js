(() => {
  const YFM = (window.YFM = window.YFM || {});

  const TICK_MS = 30 * 1000;

  const state = {
    intervalId: null,
    active: false,
  };

  function sendMessage(message) {
    try {
      chrome.runtime.sendMessage(message);
    } catch (_error) {
      // Ignore runtime messaging errors (e.g., extension reload in dev).
    }
  }

  function shouldTick() {
    return document.visibilityState === 'visible' && document.hasFocus();
  }

  function stopActiveTicker() {
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }

    if (state.active) {
      state.active = false;
      sendMessage({ type: 'TAB_INACTIVE', url: location.href });
    }
  }

  function startActiveTicker() {
    if (state.intervalId) return;

    state.active = true;
    sendMessage({ type: 'TAB_ACTIVE', url: location.href });

    state.intervalId = setInterval(() => {
      if (!shouldTick()) {
        stopActiveTicker();
        return;
      }

      sendMessage({ type: 'STATS_TICK', minutes: 0.5, url: location.href });
    }, TICK_MS);
  }

  function syncTickerState() {
    if (shouldTick()) {
      startActiveTicker();
    } else {
      stopActiveTicker();
    }
  }

  function initStatsTracking() {
    syncTickerState();
    document.addEventListener('visibilitychange', syncTickerState);
    window.addEventListener('focus', syncTickerState);
    window.addEventListener('blur', syncTickerState);
  }

  function reportHiddenCounts(counts) {
    const videos = Number(counts?.videosHiddenDelta || 0);
    const shorts = Number(counts?.shortsHiddenDelta || 0);

    if (videos <= 0 && shorts <= 0) {
      return;
    }

    sendMessage({
      type: 'STATS_HIDDEN_COUNTS',
      videosHiddenDelta: videos,
      shortsHiddenDelta: shorts,
    });
  }

  YFM.stats = {
    initStatsTracking,
    syncTickerState,
    reportHiddenCounts,
  };
})();
