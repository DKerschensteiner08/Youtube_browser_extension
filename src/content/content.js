(() => {
  const YFM = (window.YFM = window.YFM || {});

  const state = {
    settings: { ...YFM.storage.DEFAULT_SETTINGS },
    pageType: 'other',
    effectiveFocusEnabled: false,
    bypassActive: false,
  };

  function getTimerOverride(settings, now = new Date()) {
    const endsAt = Number(settings.sessionEndsAt) || 0;
    if (settings.sessionState === 'focus_session' && now.getTime() < endsAt) {
      return { active: true, mode: 'focus_session', endsAt };
    }
    if (settings.sessionState === 'break' && now.getTime() < endsAt) {
      return { active: true, mode: 'break', endsAt };
    }
    return { active: false, mode: 'none', endsAt: 0 };
  }

  function computeEffectiveFocus(settings, now = new Date()) {
    const timer = getTimerOverride(settings, now);
    if (timer.active && timer.mode === 'focus_session') {
      return true;
    }
    if (timer.active && timer.mode === 'break') {
      return false;
    }
    return YFM.schedule.effectiveFocusEnabled(settings, now);
  }

  function getRuntimeStatus(now = new Date()) {
    const pageType = YFM.pageDetect.detectPageType(location.href);
    const bypassUntil = Number(state.settings.focusBypassUntil) || 0;
    const bypassActive = now.getTime() < bypassUntil;
    const timer = getTimerOverride(state.settings, now);

    return {
      pageType,
      bypassUntil,
      bypassActive,
      effectiveFocusEnabled: computeEffectiveFocus(state.settings, now),
      scheduleActive: YFM.schedule.isWithinSchedule(state.settings, now),
      sessionState: timer.mode,
      sessionEndsAt: timer.endsAt,
      timerActive: timer.active,
      timerRemainingMs: timer.active ? Math.max(0, timer.endsAt - now.getTime()) : 0,
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
