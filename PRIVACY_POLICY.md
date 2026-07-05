# Privacy Policy for Savepoint

**Last updated: July 5, 2026**

---

## Overview

Savepoint is a Chrome extension that saves and restores YouTube video timestamps. This privacy policy explains what data Savepoint accesses, what it stores, and what it does not do.

The short version: **Savepoint stores everything locally on your device and sends nothing anywhere.**

---

## Data Savepoint collects and stores

Savepoint stores the following data locally on your device using Chrome's built-in `chrome.storage.local` API:

- **Video timestamps** — the playback position (in seconds) for each YouTube video you watch, stored under a key combining your account identifier and the video ID
- **Account identifier** — the URL of your YouTube profile avatar image, used solely as a local namespace to keep multiple accounts' progress separate from each other

This data never leaves your device. It is never transmitted to any server, never shared with third parties, and never accessed by anyone other than the Savepoint extension running locally in your browser.

---

## Data Savepoint does NOT collect

Savepoint does not collect, transmit, or store:

- Your name, email address, or any personal identifiable information
- Your YouTube watch history, search history, or browsing history
- Any analytics, usage statistics, or telemetry
- Any payment or financial information
- Any data from pages other than YouTube

---

## Permissions explained

Savepoint requests the following Chrome permissions:

- **`storage`** — to save and retrieve video timestamps locally on your device
- **`tabs`** — to read the URL of the active YouTube tab so the popup can identify which account is currently active
- **`scripting`** — to read the YouTube avatar image from the active tab, used as a local account identifier
- **`host_permissions` for `youtube.com`** — to inject the content script that powers timestamp saving and resuming on YouTube pages

None of these permissions are used to collect or transmit data externally.

---

## Data retention and deletion

Savepoint automatically deletes saved progress for a video when you watch it to completion (within the last 10 seconds, or last 5% for short videos).

You can manually delete all saved data at any time by:
- Opening the Savepoint popup and clicking **"Clear all progress"**
- Going to `chrome://extensions` → Savepoint → clicking the details icon → "Clear data"
- Uninstalling the extension, which removes all stored data

---

## Third party services

Savepoint does not use any third party services, analytics platforms, or external APIs. It communicates only with YouTube pages directly in your browser.

---

## Children's privacy

Savepoint does not knowingly collect any data from anyone, including children. Since all data is stored locally and never transmitted, no special handling is required.

---

## Changes to this policy

If this privacy policy changes in a future version of Savepoint, the "Last updated" date at the top will be updated. Significant changes will be noted in the extension's release notes.

---

## Contact

If you have questions about this privacy policy, open an issue on the [Savepoint GitHub repository](https://github.com/YOUR_USERNAME/savepoint).

---

*Savepoint is open source. You can verify everything stated in this privacy policy by reading the source code directly.*
