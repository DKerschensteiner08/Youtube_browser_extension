const DEFAULT_SYNC_SETTINGS = {
  focusEnabled: true,
  scheduleEnabled: false,
  scheduleDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  scheduleStart: '20:00',
  scheduleEnd: '23:00',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_TO_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const PERIODIC_ALARM = 'yfm-periodic-check';
const BOUNDARY_ALARM = 'yfm-schedule-boundary';

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
  const match = /^(\\d{2}):(\\d{2})$/.exec(hhmm || '');
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
    scheduleStart: typeof stored.scheduleStart === 'string' ? stored.scheduleStart : DEFAULT_SYNC_SETTINGS.scheduleStart,
    scheduleEnd: typeof stored.scheduleEnd === 'string' ? stored.scheduleEnd : DEFAULT_SYNC_SETTINGS.scheduleEnd,
  };
}

async function scheduleBoundaryAlarm() {
  const settings = await getSyncSettings();
  await chrome.alarms.clear(BOUNDARY_ALARM);

  const nextBoundary = computeNextBoundary(settings, new Date());
  if (!nextBoundary) return;

  chrome.alarms.create(BOUNDARY_ALARM, {
    when: nextBoundary.getTime(),
  });
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

async function initializeAlarms() {
  chrome.alarms.create(PERIODIC_ALARM, { periodInMinutes: 5 });
  await scheduleBoundaryAlarm();
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
  }

  if (alarm.name === BOUNDARY_ALARM) {
    await notifyYouTubeTabs('APPLY_NOW');
    await scheduleBoundaryAlarm();
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
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;

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
