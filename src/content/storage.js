(() => {
  const YFM = (window.YFM = window.YFM || {});

  const DEFAULT_SETTINGS = {
    focusEnabled: true,
    hideShorts: true,
    hideSidebarRecs: false,
    hideComments: false,
    hideHomeFeed: false,
    hideNavShorts: true,
    hideNavExplore: false,
    hideNavSubscriptionsSuggestions: false,
    keywordEnabled: false,
    keywords: [],
    keywordCaseSensitive: false,
    keywordMatchWholeWord: false,
    nudgeEnabled: false,
    nudgeOnHomeOnly: true,
    focusBypassUntil: 0,
    scheduleEnabled: false,
    scheduleDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    scheduleStart: '20:00',
    scheduleEnd: '23:00',
    sessionState: 'none',
    sessionEndsAt: 0,
    restoreFocusEnabled: true,
  };

  function normalizeTime(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const match = /^(\\d{2}):(\\d{2})$/.exec(value.trim());
    if (!match) return fallback;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return fallback;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function normalizeScheduleDays(value) {
    const allowed = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    if (!Array.isArray(value)) return [...DEFAULT_SETTINGS.scheduleDays];
    const clean = value.filter((day) => allowed.has(day));
    return clean.length ? clean : [...DEFAULT_SETTINGS.scheduleDays];
  }

  function normalizeKeywords(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const clean = [];
    for (const item of value) {
      if (typeof item !== 'string') continue;
      const trimmed = item.trim();
      if (!trimmed) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      clean.push(trimmed);
    }
    return clean;
  }

  function normalizeSettings(raw) {
    const merged = { ...DEFAULT_SETTINGS, ...(raw || {}) };
    const normalizedSessionState =
      merged.sessionState === 'focus_session' || merged.sessionState === 'break'
        ? merged.sessionState
        : 'none';

    return {
      focusEnabled: Boolean(merged.focusEnabled),
      hideShorts: Boolean(merged.hideShorts),
      hideSidebarRecs: Boolean(merged.hideSidebarRecs),
      hideComments: Boolean(merged.hideComments),
      hideHomeFeed: Boolean(merged.hideHomeFeed),
      hideNavShorts: Boolean(merged.hideNavShorts),
      hideNavExplore: Boolean(merged.hideNavExplore),
      hideNavSubscriptionsSuggestions: Boolean(merged.hideNavSubscriptionsSuggestions),
      keywordEnabled: Boolean(merged.keywordEnabled),
      keywords: normalizeKeywords(merged.keywords),
      keywordCaseSensitive: Boolean(merged.keywordCaseSensitive),
      keywordMatchWholeWord: Boolean(merged.keywordMatchWholeWord),
      nudgeEnabled: Boolean(merged.nudgeEnabled),
      nudgeOnHomeOnly: Boolean(merged.nudgeOnHomeOnly),
      focusBypassUntil: Number(merged.focusBypassUntil) || 0,
      scheduleEnabled: Boolean(merged.scheduleEnabled),
      scheduleDays: normalizeScheduleDays(merged.scheduleDays),
      scheduleStart: normalizeTime(merged.scheduleStart, DEFAULT_SETTINGS.scheduleStart),
      scheduleEnd: normalizeTime(merged.scheduleEnd, DEFAULT_SETTINGS.scheduleEnd),
      sessionState: normalizedSessionState,
      sessionEndsAt: Math.max(0, Number(merged.sessionEndsAt) || 0),
      restoreFocusEnabled: Boolean(merged.restoreFocusEnabled),
    };
  }

  async function getSettings() {
    const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    return normalizeSettings(stored);
  }

  async function setSettings(partial) {
    const next = normalizeSettings(partial);
    await chrome.storage.sync.set(next);
    return next;
  }

  async function patchSettings(partial) {
    const existing = await getSettings();
    const merged = normalizeSettings({ ...existing, ...(partial || {}) });
    await chrome.storage.sync.set(merged);
    return merged;
  }

  YFM.storage = {
    DEFAULT_SETTINGS,
    normalizeSettings,
    getSettings,
    setSettings,
    patchSettings,
  };
})();
