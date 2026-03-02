(() => {
  const YFM = (window.YFM = window.YFM || {});

  const state = {
    settings: { ...YFM.storage.DEFAULT_SETTINGS },
    pageType: 'other',
    effectiveFocusEnabled: false,
    bypassActive: false,
  };

  function getRuntimeStatus(now = new Date()) {
    const pageType = YFM.pageDetect.detectPageType(location.href);
    const bypassUntil = Number(state.settings.focusBypassUntil) || 0;
    const bypassActive = now.getTime() < bypassUntil;

    return {
      pageType,
      bypassUntil,
      bypassActive,
      effectiveFocusEnabled: YFM.schedule.effectiveFocusEnabled(state.settings, now),
      scheduleActive: YFM.schedule.isWithinSchedule(state.settings, now),
    };
  }

  async function applyNow() {
    const status = getRuntimeStatus(new Date());
    state.pageType = status.pageType;
    state.effectiveFocusEnabled = status.effectiveFocusEnabled;
    state.bypassActive = status.bypassActive;

    const counts = await YFM.apply.applyFocus({
      settings: state.settings,
      pageType: status.pageType,
      effectiveFocusEnabled: status.effectiveFocusEnabled,
      bypassActive: status.bypassActive,
      url: location.href,
    });

    YFM.stats.reportHiddenCounts(counts);

    YFM.nudge.applyNudge({
      settings: state.settings,
      pageType: status.pageType,
      effectiveFocusEnabled: status.effectiveFocusEnabled,
      bypassActive: status.bypassActive,
      url: location.href,
    });
  }

  async function reloadSettingsAndApply() {
    state.settings = await YFM.storage.getSettings();
    await applyNow();
  }

  async function initialize() {
    await reloadSettingsAndApply();

    const observer = YFM.observer.createObserverController(() => {
      applyNow();
      YFM.stats.syncTickerState();
    });

    observer.start();
    YFM.stats.initStatsTracking();

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync') return;

      const next = { ...state.settings };
      let touched = false;
      for (const key of Object.keys(YFM.storage.DEFAULT_SETTINGS)) {
        if (changes[key]) {
          next[key] = changes[key].newValue;
          touched = true;
        }
      }

      if (touched) {
        state.settings = YFM.storage.normalizeSettings(next);
        applyNow();
      }
    });

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || typeof message !== 'object') return;

      if (message.type === 'SETTINGS_UPDATED') {
        state.settings = YFM.storage.normalizeSettings(message.settings || state.settings);
        applyNow().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
        return true;
      }

      if (message.type === 'REQUEST_STATUS') {
        const status = getRuntimeStatus(new Date());
        sendResponse({ ok: true, ...status, settings: state.settings });
        return;
      }

      if (message.type === 'END_BYPASS_NOW') {
        YFM.storage
          .patchSettings({ focusBypassUntil: 0 })
          .then((settings) => {
            state.settings = settings;
            YFM.nudge.resetDismissedState();
            return applyNow();
          })
          .then(() => sendResponse({ ok: true }))
          .catch(() => sendResponse({ ok: false }));
        return true;
      }

      if (message.type === 'TIME_TICK' || message.type === 'APPLY_NOW') {
        applyNow().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
        return true;
      }
    });
  }

  initialize().catch(() => {
    state.settings = { ...YFM.storage.DEFAULT_SETTINGS };
    applyNow();
  });
})();
