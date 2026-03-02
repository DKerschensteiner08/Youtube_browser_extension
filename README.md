# YouTube Focus Mode (Manifest V3) - v2

YouTube Focus Mode is a Chrome extension that reduces YouTube distractions with configurable hiding rules, keyword filtering, timed focus sessions, quick breaks, scheduling, and local-only usage stats.

## v2 Features

- Master Focus toggle with **effective status** (schedule + bypass aware)
- Timed Focus Sessions:
  - Start a 10/20/30/45/60 minute enforced focus session
  - Session temporarily enforces focus even if the master toggle was off
  - At session end, `focusEnabled` is restored to its pre-session value
- Quick Break:
  - One-click 5-minute break temporarily disables focus rules
  - Automatically returns to normal behavior when break ends
  - End active session/break early from popup
- Hides distracting UI blocks:
  - Shorts shelves/tabs/items
  - Watch-page Up Next sidebar (optional)
  - Watch-page comments (optional)
  - Home feed recommendations (optional)
  - Left-nav entries: Shorts, Explore/Trending, and optional "More from YouTube"
- Keyword filter for Home/Search/Related videos:
  - Enable/disable
  - Newline keyword list
  - Case-sensitive option
  - Whole-word option
- Nudge overlay:
  - Prompt: "What are you here for?"
  - Quick actions: Search, Subscriptions, or Continue anyway (10-minute bypass)
- Scheduled Focus:
  - Active days (Mon-Sun)
  - Start and end times (local)
  - Supports windows crossing midnight
  - Background alarms re-apply focus on boundaries
- Local stats dashboard (`chrome.storage.local`):
  - Minutes on YouTube today (approx, +0.5 every 30s while active)
  - Videos hidden today
  - Shorts hidden today
  - Reset stats button

## Privacy

- No analytics.
- No tracking.
- No external network calls.
- Settings are saved in `chrome.storage.sync`.
- Stats are saved only on-device in `chrome.storage.local`.

## Project Structure

- `/src/manifest.json`
- `/src/background.js`
- `/src/content/content.js`
- `/src/content/apply.js`
- `/src/content/observer.js`
- `/src/content/pageDetect.js`
- `/src/content/selectors.js`
- `/src/content/keywordFilter.js`
- `/src/content/nudge.js`
- `/src/content/schedule.js`
- `/src/content/stats.js`
- `/src/content/storage.js`
- `/src/content/styles.css`
- `/src/popup/popup.html`
- `/src/popup/popup.js`
- `/src/popup/popup.css`
- `/src/icons/icon.svg`

## Install Locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `/Users/davidkerschensteiner/Coding/Youtube_extension/src`.

## Test Plan

1. Open YouTube Home: `https://www.youtube.com/`.
2. Open a watch page: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`.
3. Open search results: `https://www.youtube.com/results?search_query=study+music`.
4. Open Shorts URL: `https://www.youtube.com/shorts/...`.
5. Open Subscriptions: `https://www.youtube.com/feed/subscriptions`.
6. Validate:
   - Popup settings persist after closing/reopening popup.
   - `SETTINGS_UPDATED` applies without full tab reload.
   - Starting a timed focus session immediately applies focus rules and shows countdown.
   - Starting a break immediately shows all content and shows countdown.
   - Ending session/break early from popup immediately re-applies normal behavior.
   - Nudge appears based on Nudge settings.
   - Continue anyway starts bypass and bypass status updates in popup.
   - Schedule ON/OFF changes effective status and content behavior.
   - Keyword matches hide targeted videos only.
   - Subscriptions and History pages remain usable.
   - Stats increment during active viewing and can be reset.

## Publish (Brief)

1. Zip the contents of `/src`.
2. Upload in the Chrome Web Store Developer Dashboard.
3. Complete listing details and privacy disclosures.
4. Submit for review.

## Troubleshooting

- If YouTube layout changes, update selectors in `/src/content/selectors.js` first.
- CSS-based hide rules are built in `/src/content/apply.js` and base styles in `/src/content/styles.css`.
- If live updates fail in one tab, use **Reload YouTube tab** from popup Utilities.
- During development, reload the extension in `chrome://extensions` after code changes.
