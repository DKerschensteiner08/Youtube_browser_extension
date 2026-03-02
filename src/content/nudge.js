(() => {
  const YFM = (window.YFM = window.YFM || {});

  const OVERLAY_ID = 'yfm-nudge-overlay';

  const state = {
    dismissedForUrl: '',
  };

  function removeNudgeOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.remove();
    }
  }

  function shouldShowNudge(context) {
    const { settings, pageType, bypassActive, effectiveFocusEnabled, url } = context;
    if (!settings.nudgeEnabled) return false;
    if (!settings.focusEnabled) return false;
    if (!effectiveFocusEnabled) return false;
    if (bypassActive) return false;
    if (settings.nudgeOnHomeOnly && pageType !== 'home') return false;
    if (state.dismissedForUrl === url) return false;
    return true;
  }

  function createButton(text, className, onClick) {
    const button = document.createElement('button');
    button.className = `yfm-nudge-btn ${className}`;
    button.type = 'button';
    button.textContent = text;
    button.addEventListener('click', onClick);
    return button;
  }

  async function setBypassForTenMinutes() {
    const until = Date.now() + 10 * 60 * 1000;
    await YFM.storage.patchSettings({ focusBypassUntil: until });
    window.dispatchEvent(new CustomEvent('yfm-settings-updated-locally'));
  }

  function showNudgeOverlay(context) {
    removeNudgeOverlay();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;

    const card = document.createElement('div');
    card.id = 'yfm-nudge-card';

    const title = document.createElement('h2');
    title.textContent = 'What are you here for?';

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Choose a focused path or take a short temporary bypass.';

    const actions = document.createElement('div');
    actions.className = 'yfm-nudge-actions';

    actions.appendChild(
      createButton('Go to Search', 'yfm-nudge-btn--primary', () => {
        state.dismissedForUrl = context.url;
        location.href = '/results?search_query=';
      })
    );

    actions.appendChild(
      createButton('Go to Subscriptions', 'yfm-nudge-btn--secondary', () => {
        state.dismissedForUrl = context.url;
        location.href = '/feed/subscriptions';
      })
    );

    actions.appendChild(
      createButton('Continue anyway (10 minutes)', 'yfm-nudge-btn--secondary', async () => {
        state.dismissedForUrl = context.url;
        await setBypassForTenMinutes();
      })
    );

    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.documentElement.appendChild(overlay);
  }

  function applyNudge(context) {
    if (shouldShowNudge(context)) {
      showNudgeOverlay(context);
      return;
    }

    removeNudgeOverlay();
  }

  function resetDismissedState() {
    state.dismissedForUrl = '';
  }

  YFM.nudge = {
    applyNudge,
    removeNudgeOverlay,
    resetDismissedState,
  };
})();
