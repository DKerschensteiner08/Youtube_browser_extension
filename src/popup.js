const DEFAULT_SETTINGS = {
  focusEnabled: true,
  hideShorts: true,
  hideSidebarRecs: false,
  hideComments: false,
  hideHomeFeed: false,
};

const FIELD_IDS = Object.keys(DEFAULT_SETTINGS);
const statusEl = document.getElementById('status');
const reloadBtn = document.getElementById('reloadBtn');

function setStatus(message) {
  statusEl.textContent = message;
}

async function getCurrentYouTubeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];

  if (!activeTab || !activeTab.id || !activeTab.url) {
    return null;
  }

  return activeTab.url.startsWith('https://www.youtube.com/') ? activeTab : null;
}

function readFormState() {
  const result = {};

  for (const id of FIELD_IDS) {
    const input = document.getElementById(id);
    result[id] = Boolean(input?.checked);
  }

  return result;
}

function writeFormState(settings) {
  for (const id of FIELD_IDS) {
    const input = document.getElementById(id);
    if (input) {
      input.checked = Boolean(settings[id]);
    }
  }
}

async function notifyActiveYouTubeTab(settings) {
  const tab = await getCurrentYouTubeTab();

  if (!tab) {
    setStatus('No active YouTube tab detected.');
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'SETTINGS_UPDATED',
      settings,
    });
    setStatus('Applied to active YouTube tab.');
  } catch (error) {
    setStatus('Saved. Open YouTube and reload once if needed.');
  }
}

async function saveAndApply() {
  const settings = readFormState();
  await chrome.storage.sync.set(settings);
  await notifyActiveYouTubeTab(settings);
}

async function init() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  writeFormState(settings);

  const activeTab = await getCurrentYouTubeTab();
  setStatus(
    activeTab
      ? 'Ready to apply on this YouTube tab.'
      : 'Open a YouTube tab to apply changes live.'
  );

  for (const id of FIELD_IDS) {
    const input = document.getElementById(id);
    input?.addEventListener('change', saveAndApply);
  }

  reloadBtn.addEventListener('click', async () => {
    const tab = await getCurrentYouTubeTab();
    if (!tab) {
      setStatus('No active YouTube tab to reload.');
      return;
    }

    await chrome.tabs.reload(tab.id);
    setStatus('YouTube tab reloading...');
  });
}

init().catch(() => {
  setStatus('Failed to initialize popup.');
});
