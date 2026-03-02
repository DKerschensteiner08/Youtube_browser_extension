# Changelog

## v2.0.0 - 2026-03-02

### Added
- Modular content architecture under `/src/content`.
- Background service worker (`background.js`) with `chrome.alarms` schedule rechecks.
- New navigation cleanup toggles:
  - `hideNavShorts`
  - `hideNavExplore`
  - `hideNavSubscriptionsSuggestions`
- Keyword filtering with sync-backed keywords list and matching options.
- Nudge overlay with temporary 10-minute bypass.
- Schedule-aware effective focus state (supports cross-midnight windows).
- Local stats tracking dashboard and reset action.
- Expanded popup UI sections for Master, Distractions, Keyword Filter, Nudge, Schedule, Stats, and Utilities.

### Changed
- Refactored popup from root files into `/src/popup/*`.
- Replaced monolithic content script with feature modules.
- Updated manifest to MV3 v2 layout with background service worker and alarms permission.

### Privacy
- Confirmed no analytics, no tracking, and no external network requests.
- Settings in `chrome.storage.sync`; stats in `chrome.storage.local`.
