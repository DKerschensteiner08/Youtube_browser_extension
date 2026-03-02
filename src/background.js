const DEFAULT_SYNC_SETTINGS = {
  focusEnabled: true,
  scheduleEnabled: false,
  scheduleDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  scheduleStart: '20:00',
  scheduleEnd: '23:00',
  sessionState: 'none',
  sessionEndsAt: 0,
  restoreFocusEnabled: true,
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_TO_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const PERIODIC_ALARM = 'yfm-periodic-check';
const BOUNDARY_ALARM = 'yfm-schedule-boundary';
const TIMER_END_ALARM = 'yfm-timer-end';
const TIMER_FALLBACK_ALARM = 'yfm-timer-fallback';

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function getTodayStats() {
  const nowKey = todayKey();
  const stored = await chrome.storage.local.get('statsToday');
  const stats = stored.statsToday || {};

  if (stats.date !== nowKey) {
    const fresh = {
      date: nowKey,
      minutesOnYouTubeToday: 0,
      videosHiddenCountToday: 0,
      shortsHiddenCountToday: 0,
    };
    await chrome.storage.local.set({ statsToday: fresh });
    return fresh;
  }

  return {
    date: nowKey,
    minutesOnYouTubeToday: Number(stats.minutesOnYouTubeToday) || 0,
    videosHiddenCountToday: Number(stats.videosHiddenCountToday) || 0,
    shortsHiddenCountToday: Number(stats.shortsHiddenCountToday) || 0,
  };
}

function parseMinutes(hhmm) {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm || '');
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function withDayTime(baseDate, dayIndex, minutesFromMidnight) {
  const next = new Date(baseDate);
  const currentDay = next.getDay();
  const delta = (dayIndex - currentDay + 7) % 7;
  next.setDate(next.getDate() + delta);
  next.setHours(Math.floor(minutesFromMidnight / 60), minutesFromMidnight % 60, 0, 0);
  return next;
}

function computeNextBoundary(settings, now = new Date()) {
  if (!settings.scheduleEnabled) return null;

  const days = Array.isArray(settings.scheduleDays) ? settings.scheduleDays : [];
  if (!days.length) return null;

  const start = parseMinutes(settings.scheduleStart);
  const end = parseMinutes(settings.scheduleEnd);
  const candidates = [];

  for (const dayName of days) {
    const dayIndex = DAY_TO_INDEX[dayName];
    if (dayIndex === undefined) continue;

    for (let weekOffset = 0; weekOffset <= 1; weekOffset += 1) {
      const startDate = withDayTime(now, dayIndex, start);
      startDate.setDate(startDate.getDate() + weekOffset * 7);
      if (startDate.getTime() > now.getTime()) candidates.push(startDate);

      const endDate = new Date(startDate);
      if (start <= end) {
        endDate.setHours(Math.floor(end / 60), end % 60, 0, 0);
      } else {
        endDate.setDate(endDate.getDate() + 1);
        endDate.setHours(Math.floor(end / 60), end % 60, 0, 0);
      }
      if (endDate.getTime() > now.getTime()) candidates.push(endDate);
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0];
}

function normalizeSessionState(value) {
  if (value === 'focus_session' || value === 'break') {
    return value;
  }
  return 'none';
}

function isActiveTimer(settings, nowMs = Date.now()) {
  const state = normalizeSessionState(settings.sessionState);
  const endsAt = Math.max(0, Number(settings.sessionEndsAt) || 0);
  return (state === 'focus_session' || state === 'break') && nowMs < endsAt;
}

async function getSyncSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SYNC_SETTINGS);
  const daySet = new Set(DAY_NAMES);
  const scheduleDays = Array.isArray(stored.scheduleDays)
    ? stored.scheduleDays.filter((day) => daySet.has(day))
    : DEFAULT_SYNC_SETTINGS.scheduleDays;

  return {
    focusEnabled: Boolean(stored.focusEnabled),
    scheduleEnabled: Boolean(stored.scheduleEnabled),
    scheduleDays: scheduleDays.length ? scheduleDays : DEFAULT_SYNC_SETTINGS.scheduleDays,
    scheduleStart:
      typeof stored.scheduleStart === 'string'
        ? stored.scheduleStart
        : DEFAULT_SYNC_SETTINGS.scheduleStart,
    scheduleEnd:
      typeof stored.scheduleEnd === 'string' ? stored.scheduleEnd : DEFAULT_SYNC_SETTINGS.scheduleEnd,
    sessionState: normalizeSessionState(stored.sessionState),
    sessionEndsAt: Math.max(0, Number(stored.sessionEndsAt) || 0),
    restoreFocusEnabled: Boolean(stored.restoreFocusEnabled),
  };
}

async function notifyYouTubeTabs(type = 'APPLY_NOW') {
  const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id) return;
      try {
        await chrome.tabs.sendMessage(tab.id, { type });
      } catch (_error) {
        // Ignore tabs where content script is not ready.
      }
    })
  );
}

async function scheduleBoundaryAlarm() {
  const settings = await getSyncSettings();
  await chrome.alarms.clear(BOUNDARY_ALARM);

  const nextBoundary = computeNextBoundary(settings, new Date());
  if (!nextBoundary) return;

  chrome.alarms.create(BOUNDARY_ALARM, { when: nextBoundary.getTime() });
}

async function clearTimerAlarms() {
  await Promise.all([chrome.alarms.clear(TIMER_END_ALARM), chrome.alarms.clear(TIMER_FALLBACK_ALARM)]);
}

async function ensureTimerAlarms() {
  const settings = await getSyncSettings();

  if (!isActiveTimer(settings)) {
    await clearTimerAlarms();
    return;
  }

  await chrome.alarms.clear(TIMER_END_ALARM);
  chrome.alarms.create(TIMER_END_ALARM, { when: settings.sessionEndsAt });
  chrome.alarms.create(TIMER_FALLBACK_ALARM, { periodInMinutes: 1 });
}

async function clearActiveTimerAndRestore(settings) {
  const patch = {
    sessionState: 'none',
    sessionEndsAt: 0,
  };

  if (settings.sessionState === 'focus_session') {
    patch.focusEnabled = Boolean(settings.restoreFocusEnabled);
  }

  await chrome.storage.sync.set(patch);
  await clearTimerAlarms();
  await notifyYouTubeTabs('APPLY_NOW');

  return {
    ...settings,
    ...patch,
  };
}

async function normalizeExpiredTimerIfNeeded() {
  const settings = await getSyncSettings();
  const active = isActiveTimer(settings);

  if (active) {
    await ensureTimerAlarms();
    return settings;
  }

  if (settings.sessionState !== 'none' || settings.sessionEndsAt !== 0) {
    return clearActiveTimerAndRestore(settings);
  }

  await clearTimerAlarms();
  return settings;
}

async function startFocusSession(durationMinutes) {
  const settings = await getSyncSettings();
  const now = Date.now();
  const duration = Math.max(1, Number(durationMinutes) || 0);
  const endsAt = now + duration * 60 * 1000;

  const keepExistingRestore =
    settings.sessionState === 'focus_session' && settings.sessionEndsAt > now && isActiveTimer(settings, now);

  const restoreFocusEnabled = keepExistingRestore
    ? Boolean(settings.restoreFocusEnabled)
    : Boolean(settings.focusEnabled);

  const patch = {
    focusEnabled: true,
    sessionState: 'focus_session',
    sessionEndsAt: endsAt,
    restoreFocusEnabled,
  };

  await chrome.storage.sync.set(patch);
  await ensureTimerAlarms();
  await notifyYouTubeTabs('APPLY_NOW');

  return { ...settings, ...patch };
}

async function startBreak(durationMinutes) {
  const settings = await getSyncSettings();
  const now = Date.now();
  const duration = Math.max(1, Number(durationMinutes) || 0);
  const endsAt = now + duration * 60 * 1000;

  const patch = {
    sessionState: 'break',
    sessionEndsAt: endsAt,
  };

  if (settings.sessionState === 'focus_session' && isActiveTimer(settings, now)) {
    const restored = Boolean(settings.restoreFocusEnabled);
    patch.focusEnabled = restored;
    patch.restoreFocusEnabled = restored;
  }

  await chrome.storage.sync.set(patch);
  await ensureTimerAlarms();
  await notifyYouTubeTabs('APPLY_NOW');

  return { ...settings, ...patch };
}

async function endActiveTimer() {
  const settings = await getSyncSettings();

  if (!isActiveTimer(settings) && settings.sessionState === 'none' && settings.sessionEndsAt === 0) {
    await clearTimerAlarms();
    return settings;
  }

  return clearActiveTimerAndRestore(settings);
}

async function getTimerStatus() {
  const settings = await normalizeExpiredTimerIfNeeded();
  const now = Date.now();
  const active = isActiveTimer(settings, now);

  return {
    sessionState: active ? settings.sessionState : 'none',
    sessionEndsAt: active ? settings.sessionEndsAt : 0,
    isActive: active,
    remainingMs: active ? Math.max(0, settings.sessionEndsAt - now) : 0,
  };
}

async function initializeAlarms() {
  chrome.alarms.create(PERIODIC_ALARM, { periodInMinutes: 5 });
  await scheduleBoundaryAlarm();
  await normalizeExpiredTimerIfNeeded();
}

chrome.runtime.onInstalled.addListener(() => {
  initializeAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  initializeAlarms();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === PERIODIC_ALARM) {
    await notifyYouTubeTabs('TIME_TICK');
    await scheduleBoundaryAlarm();
    await normalizeExpiredTimerIfNeeded();
  }

  if (alarm.name === BOUNDARY_ALARM) {
    await notifyYouTubeTabs('APPLY_NOW');
    await scheduleBoundaryAlarm();
  }

  if (alarm.name === TIMER_END_ALARM || alarm.name === TIMER_FALLBACK_ALARM) {
    await normalizeExpiredTimerIfNeeded();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;

  if (
    changes.scheduleEnabled ||
    changes.scheduleDays ||
    changes.scheduleStart ||
    changes.scheduleEnd ||
    changes.focusEnabled
  ) {
    scheduleBoundaryAlarm();
  }

  if (changes.sessionState || changes.sessionEndsAt) {
    ensureTimerAlarms();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;

  if (message.type === 'START_FOCUS_SESSION') {
    startFocusSession(message.durationMinutes)
      .then(() => getTimerStatus())
      .then((status) => sendResponse({ ok: true, ...status }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'START_BREAK') {
    startBreak(message.durationMinutes)
      .then(() => getTimerStatus())
      .then((status) => sendResponse({ ok: true, ...status }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'END_ACTIVE_TIMER') {
    endActiveTimer()
      .then(() => getTimerStatus())
      .then((status) => sendResponse({ ok: true, ...status }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'GET_TIMER_STATUS') {
    getTimerStatus()
      .then((status) => sendResponse({ ok: true, ...status }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'STATS_TICK') {
    getTodayStats()
      .then((stats) => {
        const add = Math.max(0, Number(message.minutes) || 0);
        const next = {
          ...stats,
          minutesOnYouTubeToday: Math.round((stats.minutesOnYouTubeToday + add) * 10) / 10,
        };
        return chrome.storage.local.set({ statsToday: next });
      })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'STATS_HIDDEN_COUNTS') {
    getTodayStats()
      .then((stats) => {
        const next = {
          ...stats,
          videosHiddenCountToday:
            stats.videosHiddenCountToday + Math.max(0, Number(message.videosHiddenDelta) || 0),
          shortsHiddenCountToday:
            stats.shortsHiddenCountToday + Math.max(0, Number(message.shortsHiddenDelta) || 0),
        };
        return chrome.storage.local.set({ statsToday: next });
      })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'GET_STATS') {
    getTodayStats()
      .then((stats) => sendResponse({ ok: true, stats }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'RESET_STATS') {
    const reset = {
      date: todayKey(),
      minutesOnYouTubeToday: 0,
      videosHiddenCountToday: 0,
      shortsHiddenCountToday: 0,
    };

    chrome.storage.local
      .set({ statsToday: reset })
      .then(() => sendResponse({ ok: true, stats: reset }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'TAB_ACTIVE' || message.type === 'TAB_INACTIVE') {
    sendResponse({ ok: true });
  }
});
