# SavePoint

<p align="center">
  <img src="icon128.png" width="96" alt="Savepoint icon"/>
</p>

**Never lose your place in a YouTube video again.**

<p align="center">
  <a href="https://chromewebstore.google.com/detail/hebppmfgnmgdfpnijikehfecjdpbjdpn">
    <img src="https://img.shields.io/badge/Chrome_Web_Store-Install_Now-FF0000?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Install on Chrome"/>
  </a>
</p>

---

## The problem

A lot of people turn off YouTube watch history to avoid distraction-driven recommendations. It works — but it comes at a cost: YouTube stops remembering where you left off in videos. Every time you return to a long lecture, tutorial, or course, you're hunting for your place manually.

Savepoint fixes that. It runs silently in the background, saving your progress every few seconds and restoring it automatically the next time you open the same video.

---

## Features

- **Auto-save** — saves your timestamp every 3 seconds, per video
- **Auto-resume** — picks up exactly where you left off when you reopen a video
- **Ad-aware** — correctly skips ads before resuming the real video
- **Account-aware** — keeps each YouTube account's progress private and separate
- **In-progress badge** — shows a red indicator on thumbnails of videos you've started (toggle on/off from the popup)
- **Popup** — see how many videos are in progress, toggle badges, and clear all progress with one click
- **Works everywhere on YouTube** — homepage, search, subscriptions, playlists, sidebar, channel pages

---

## Installation

### From the Chrome Web Store
[**Install Savepoint →**](https://chromewebstore.google.com/detail/hebppmfgnmgdfpnijikehfecjdpbjdpn)

### Manual installation (Developer mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the `Savepoint` folder
6. Navigate to any YouTube video — Savepoint is now active

---

## How it works

Savepoint is a Manifest V3 Chrome extension with two main components:

**`content.js`** — injected into every YouTube page. It:
- Detects the active video element and reads `video.currentTime`
- Saves progress to `chrome.storage.local` every 3 seconds, keyed by account + video ID
- Restores saved timestamps on page load, correctly handling ads and SPA navigation
- Scans thumbnails and adds a red corner badge to in-progress videos using a `MutationObserver`
- Supports both YouTube's old and new thumbnail rendering systems

**`popup.html` / `popup.js`** — the extension popup. It:
- Reads the active YouTube tab to detect the current account
- Shows a count of in-progress videos for that account
- Provides a toggle to enable/disable thumbnail badges
- Provides a "Clear all progress" action with confirmation

**Account isolation** — Savepoint extracts a stable unique ID from the YouTube avatar image URL, so progress saved on one account is never visible to another account in the same browser — even across different CDN domains serving the same image.

**Finished detection** — when you reach within the last 10 seconds (or last 5% for short videos) of a video, Savepoint automatically removes the saved entry and clears the badge.

---

## Privacy

Savepoint stores data **only on your device** using `chrome.storage.local`. It never:
- Sends any data to external servers
- Collects analytics or usage data
- Reads any personal information beyond what's needed to identify the current YouTube account and video

[Full privacy policy →](PRIVACY_POLICY.md)

---

## Requirements

- Google Chrome (or any Chromium-based browser)
- A YouTube account (Savepoint requires a logged-in account to function)

---

## Changelog

**v1.1**
- Fixed thumbnail badges not appearing on channel pages and watch page sidebar
- Fixed account identifier stability across different CDN domains
- Added toggle in popup to enable/disable thumbnail badges

**v1.0**
- Initial release

---

## Contributing

Savepoint is open source and contributions are welcome.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Test thoroughly on YouTube (homepage, search, watch pages, account switching)
5. Open a pull request with a clear description of what changed and why

**Known limitations / good first issues:**
- Multiple tabs of the same video open simultaneously may overwrite each other's saved progress (last write wins)

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

*Built to solve a real problem. If Savepoint helps you, consider starring the repo or leaving a review on the [Chrome Web Store](https://chromewebstore.google.com/detail/hebppmfgnmgdfpnijikehfecjdpbjdpn).*
