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
};

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CHECKBOX_FIELDS = [
  'focusEnabled',
  'hideShorts',
  'hideSidebarRecs',
  'hideComments',
  'hideHomeFeed',
  'hideNavShorts',
  'hideNavExplore',
  'hideNavSubscriptionsSuggestions',
  'keywordEnabled',
  'keywordCaseSensitive',
  'keywordMatchWholeWord',
  'nudgeEnabled',
  'nudgeOnHomeOnly',
  'scheduleEnabled',
];

const statusEl = document.getElementById('status');
const effectiveStatusEl = document.getElementById('effectiveStatus');
const bypassStatusEl = document.getElementById('bypassStatus');
const keywordsEl = document.getElementById('keywords');
const scheduleDaysEl = document.getElementById('scheduleDays');
const scheduleStartEl = document.getElementById('scheduleStart');
const scheduleEndEl = document.getElementById('scheduleEnd');
const reloadBtn = document.getElementById('reloadBtn');
const endBypassBtn = document.getElementById('endBypassBtn');
const resetStatsBtn = document.getElementById('resetStatsBtn');

const statMinutesEl = document.getElementById('statMinutes');
const statVideosEl = document.getElementById('statVideos');
const statShortsEl = document.getElementById('statShorts');

let keywordDebounce = null;
let currentSettings = { ...DEFAULT_SETTINGS };

function setStatus(message) {
  statusEl.textContent = message;
}

function localDateTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString();
}

function parseKeywords(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function renderDays(selectedDays) {
  scheduleDaysEl.innerHTML = '';

  for (const day of DAY_ORDER) {
    const label = document.createElement('label');
    label.className = 'day-pill';

    const text = document.createElement('span');
    text.textContent = day;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = day;
    input.checked = selectedDays.includes(day);
    input.addEventListener('change', saveAndApply);

    label.appendChild(text);
    label.appendChild(input);
    scheduleDaysEl.appendChild(label);
  }
}

function getSelectedDays() {
  const checks = scheduleDaysEl.querySelectorAll('input[type="checkbox"]');
  return Array.from(checks)
    .filter((el) => el.checked)
    .map((el) => el.value);
}

async function getCurrentYouTubeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !tab.id || !tab.url) return null;
  if (!tab.url.startsWith('https://www.youtube.com/')) return null;
  return tab;
}

async function messageActiveTab(message) {
  const tab = await getCurrentYouTubeTab();
  if (!tab) return { ok: false, reason: 'no-tab' };

  try {
    const response = await chrome.tabs.sendMessage(tab.id, message);
    return response || { ok: true };
  } catch (_error) {
    return { ok: false, reason: 'send-failed' };
  }
}

function readFormState() {
  const settings = { ...currentSettings };

  for (const id of CHECKBOX_FIELDS) {
    const input = document.getElementById(id);
    settings[id] = Boolean(input?.checked);
  }

  settings.keywords = parseKeywords(keywordsEl.value);
  settings.scheduleDays = getSelectedDays();
  settings.scheduleStart = scheduleStartEl.value || DEFAULT_SETTINGS.scheduleStart;
  settings.scheduleEnd = scheduleEndEl.value || DEFAULT_SETTINGS.scheduleEnd;

  return settings;
}

function writeFormState(settings) {
  for (const id of CHECKBOX_FIELDS) {
    const input = document.getElementById(id);
    if (input) input.checked = Boolean(settings[id]);
  }

  keywordsEl.value = (settings.keywords || []).join('\n');
  scheduleStartEl.value = settings.scheduleStart;
  scheduleEndEl.value = settings.scheduleEnd;
  renderDays(settings.scheduleDays || []);
}

function renderBypassStatus(settings) {
  const until = Number(settings.focusBypassUntil) || 0;
  if (until > Date.now()) {
    bypassStatusEl.textContent = `Bypass active until ${localDateTime(until)}`;
  } else {
    bypassStatusEl.textContent = 'No active bypass.';
  }
}

function isWithinSchedule(settings, now = new Date()) {
  if (!settings.scheduleEnabled) return true;

  const activeDays = new Set(settings.scheduleDays || []);
  if (!activeDays.size) return false;

  const parse = (val) => {
    const [h, m] = (val || '00:00').split(':').map(Number);
    return h * 60 + m;
  };

  const start = parse(settings.scheduleStart);
  const end = parse(settings.scheduleEnd);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = dayNames[now.getDay()];
  const yesterday = dayNames[(now.getDay() + 6) % 7];

  if (start === end) return activeDays.has(today);
  if (start < end) return activeDays.has(today) && nowMin >= start && nowMin < end;
  return (activeDays.has(today) && nowMin >= start) || (activeDays.has(yesterday) && nowMin < end);
}

function computeEffectiveText(settings) {
  const bypassActive = (Number(settings.focusBypassUntil) || 0) > Date.now();
  const effective = settings.focusEnabled && isWithinSchedule(settings) && !bypassActive;
  if (effective) return 'Effective Focus: ON';

  if (!settings.focusEnabled) return 'Effective Focus: OFF (master toggle disabled)';
  if (bypassActive) return 'Effective Focus: OFF (temporary bypass active)';
  if (settings.scheduleEnabled && !isWithinSchedule(settings)) return 'Effective Focus: OFF (outside schedule)';
  return 'Effective Focus: OFF';
}

function renderEffectiveStatusFromSettings(settings) {
  effectiveStatusEl.textContent = computeEffectiveText(settings);
  renderBypassStatus(settings);
}

async function renderStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
    const stats = response?.stats;
    statMinutesEl.textContent = String(Number(stats?.minutesOnYouTubeToday || 0).toFixed(1));
    statVideosEl.textContent = String(Number(stats?.videosHiddenCountToday || 0));
    statShortsEl.textContent = String(Number(stats?.shortsHiddenCountToday || 0));
  } catch (_error) {
    statMinutesEl.textContent = '0.0';
    statVideosEl.textContent = '0';
    statShortsEl.textContent = '0';
  }
}

async function saveAndApply() {
  const settings = readFormState();
  currentSettings = { ...currentSettings, ...settings };
  await chrome.storage.sync.set(settings);

  const response = await messageActiveTab({
    type: 'SETTINGS_UPDATED',
    settings,
  });

  if (response.ok) {
    setStatus('Settings saved and applied.');
  } else {
    setStatus('Settings saved. Open a YouTube tab to apply live.');
  }

  renderEffectiveStatusFromSettings(currentSettings);
}

function bindControls() {
  for (const id of CHECKBOX_FIELDS) {
    const input = document.getElementById(id);
    input?.addEventListener('change', saveAndApply);
  }

  scheduleStartEl.addEventListener('change', saveAndApply);
  scheduleEndEl.addEventListener('change', saveAndApply);

  keywordsEl.addEventListener('input', () => {
    clearTimeout(keywordDebounce);
    keywordDebounce = setTimeout(() => {
      saveAndApply();
    }, 250);
  });

  reloadBtn.addEventListener('click', async () => {
    const tab = await getCurrentYouTubeTab();
    if (!tab) {
      setStatus('No active YouTube tab to reload.');
      return;
    }

    await chrome.tabs.reload(tab.id);
    setStatus('YouTube tab reloading...');
  });

  endBypassBtn.addEventListener('click', async () => {
    currentSettings.focusBypassUntil = 0;
    await chrome.storage.sync.set({ focusBypassUntil: 0 });
    await messageActiveTab({ type: 'END_BYPASS_NOW' });
    renderBypassStatus(currentSettings);
    renderEffectiveStatusFromSettings(currentSettings);
    setStatus('Bypass ended.');
  });

  resetStatsBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'RESET_STATS' });
    await renderStats();
    setStatus('Stats reset for today.');
  });
}

async function refreshStatusFromContent() {
  const response = await messageActiveTab({ type: 'REQUEST_STATUS' });
  if (response.ok) {
    if (response.settings) {
      currentSettings = { ...currentSettings, ...response.settings };
    }
    effectiveStatusEl.textContent = response.effectiveFocusEnabled
      ? 'Effective Focus: ON'
      : 'Effective Focus: OFF';

    if (response.bypassActive) {
      bypassStatusEl.textContent = `Bypass active until ${localDateTime(response.bypassUntil)}`;
    } else {
      renderBypassStatus(currentSettings);
    }

    setStatus('Connected to active YouTube tab.');
  } else {
    renderEffectiveStatusFromSettings(currentSettings);
    setStatus('Open a YouTube tab to apply settings live.');
  }
}

async function init() {
  bindControls();

  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  currentSettings = settings;

  writeFormState(settings);
  renderEffectiveStatusFromSettings(settings);
  await refreshStatusFromContent();
  await renderStats();
}

init().catch(() => {
  setStatus('Failed to initialize popup.');
});
