# YouTube Focus Mode (Manifest V3)

YouTube Focus Mode is a Chrome extension that removes distracting YouTube UI sections while keeping normal video playback and core navigation intact.

## Features

- Master **Focus Mode** toggle
- Hide **Shorts** shelves/tabs/items (Home, Search, Sidebar)
- Optional hide for watch-page **Up Next / sidebar recommendations**
- Optional hide for watch-page **Comments**
- Optional hide for **Home feed recommendations**
- Settings persist via `chrome.storage.sync`
- Handles YouTube SPA updates via `MutationObserver` + debounced re-apply
- No analytics, no tracking, no external network requests

## Project Structure

- `/src/manifest.json`
- `/src/content.js`
- `/src/popup.html`
- `/src/popup.js`
- `/src/popup.css`
- `/src/icons/icon.svg`

## Install Locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked**.
4. Select the `/src` folder in this repo.

## How to Test

1. Open YouTube (`https://www.youtube.com/`).
2. Click the extension icon and verify toggles appear.
3. Test each option:
   - **Hide Shorts**: Shorts shelf/tab/items should disappear.
   - **Hide Up Next Sidebar**: watch page recommendations should hide.
   - **Hide Comments**: watch page comments should hide.
   - **Hide Home Feed**: home recommendation feed should hide.
4. Navigate between Home, Search, and Watch pages; confirm behavior persists.
5. Toggle settings off again and verify sections return.
6. If needed, click **Reload YouTube tab** from the popup.

## Publish Later (Brief)

1. Zip the `src` directory contents.
2. Create a developer account in the Chrome Web Store.
3. Upload package in the Developer Dashboard.
4. Fill listing details, privacy disclosures, and submit for review.

## Troubleshooting

- If a YouTube section is not hidden, YouTube likely changed DOM selectors.
- Update the selector arrays near the top of `/src/content.js` (`SELECTORS`) first.
- Keep fallback text/link checks in place for resiliency.
- Reload the extension from `chrome://extensions` after code changes.

## Privacy

- Uses only `storage` permission and YouTube host permission.
- Stores settings in `chrome.storage.sync`.
- Sends no telemetry and performs no third-party requests.
